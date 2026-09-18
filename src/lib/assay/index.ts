/**
 * The assay engine.
 *
 * Six tests, run in order of cost. Each compares what the registry claims
 * against what the chain proves, and each returns evidence rather than an
 * opinion. The order matters: `activity` runs before `capability` because a
 * wallet with nonce 0 has provably never interacted with anything, which
 * settles capability for free.
 */

import {
  CATEGORY_EVENT_PROBES,
  CATEGORY_EVIDENCE,
  CATEGORY_LABEL,
  PROTOCOL_LABEL,
  addressUrl,
  txUrl,
  type Category,
} from "@/lib/config";
import {
  findProtocolTouches,
  getWalletFacts,
  isAddress,
  bnb,
  type WalletFacts,
} from "@/lib/sources/bsc";
import { firstHand, houseFacts, type FirstHand, type HouseFacts } from "./firsthand";
import { getAgentIndex } from "@/lib/data/agents";
import { withTimeout } from "@/lib/cache";
import type { ScanAgentDetail, ScanFeedback } from "@/lib/sources/scan";
import { getAgent, listFeedbacks } from "@/lib/sources/scan";
import { classify, extractSkills, type Classification } from "./classify";
import { referenceBySlug } from "@/lib/house";
import { assessFeedback, type SybilVerdict } from "@/lib/sybil/detect";
import {
  computeFineness,
  hallmarkFor,
  type AssayReport,
  type AssayResult,
  type Evidence,
} from "./types";

export interface AssayContext {
  detail: ScanAgentDetail;
  classification: Classification;
  wallet: WalletFacts | null;
  feedbacks: ScanFeedback[];
  sybil: SybilVerdict | null;
  /**
   * False when the feedback corpus could not be fetched.
   *
   * An agent with no reviews and an agent whose reviews could not be read are
   * different claims, and only one of them is about the agent. Without this
   * flag an outage at the index would be reported as "no reputation here",
   * which is the kind of silent zero this whole product exists to object to.
   */
  feedbacksRead?: boolean;
  /** Our own probe, our own paid calls, and their answers checked against the chain. */
  firsthand?: FirstHand;
  /** Set for our own reference agents: the account that acts, and its record. */
  house?: HouseFacts | null;
}

const WEIGHTS = {
  identity: 250,
  custody: 150,
  activity: 250,
  capability: 200,
  reputation: 100,
  performance: 50,
} as const;

// ---------------------------------------------------------------------------
// 1. Identity, does the thing the registry points at actually exist?
// ---------------------------------------------------------------------------

function identityAssay(ctx: AssayContext): AssayResult {
  const d = ctx.detail;
  const evidence: Evidence[] = [];

  /*
    Our own call outranks the explorer's flag. 8004scan verifies only the
    card formats it indexes, and it reported "points nowhere" about an agent
    whose endpoint had answered us, and taken our money, five times.
  */
  const probe = ctx.firsthand?.probe;
  if (probe?.answered && probe.endpoint) {
    evidence.push({ kind: "note", label: "Endpoint we called", value: probe.endpoint, url: probe.endpoint });
    evidence.push({ kind: "api", label: "It answered", value: `HTTP ${probe.status ?? "?"} in ${probe.latencyMs ?? "?"} ms, ${probe.at.slice(0, 16).replace("T", " ")} UTC` });
    if (d.is_endpoint_verified === true) evidence.push({ kind: "api", label: "8004scan", value: "also marks the endpoint verified" });
    return {
      id: "identity",
      title: "Identity",
      claim: `Declares a service at ${host(probe.endpoint)}, and we called it.`,
      finding: `Answered our call${probe.status === 402 ? " by asking to be paid, which is an answer" : ""}. This agent can be reached.`,
      verdict: "pass",
      score: 1,
      weight: WEIGHTS.identity,
      evidence,
    };
  }
  if (probe && probe.endpoint && !probe.answered) {
    evidence.push({ kind: "note", label: "Endpoint we called", value: probe.endpoint, url: probe.endpoint });
    evidence.push({ kind: "api", label: "Our call", value: `no answer (${probe.error ?? "silent"}), ${probe.at.slice(0, 16).replace("T", " ")} UTC` });
  }

  const endpoint = d.a2a_endpoint ?? d.mcp_server ?? d.agent_url ?? probe?.endpoint ?? null;

  if (endpoint) {
    evidence.push({ kind: "note", label: "Declared endpoint", value: endpoint, url: endpoint });
  }
  if (d.endpoint_last_checked_at) {
    evidence.push({
      kind: "api",
      label: "Last probed by 8004scan",
      value: d.endpoint_last_checked_at,
    });
  }
  if (d.endpoint_verification_error) {
    evidence.push({
      kind: "note",
      label: "Verification error",
      value: d.endpoint_verification_error,
    });
  }

  const verified = d.is_endpoint_verified === true;
  const claim = endpoint
    ? `Declares a reachable service endpoint at ${host(endpoint)}.`
    : "Declares no service endpoint.";

  if (verified) {
    return {
      id: "identity",
      title: "Identity",
      claim,
      finding: `Endpoint verified${d.endpoint_verified_domain ? ` on ${d.endpoint_verified_domain}` : ""}. This agent can be reached.`,
      verdict: "pass",
      score: 1,
      weight: WEIGHTS.identity,
      evidence,
    };
  }

  if (endpoint) {
    return {
      id: "identity",
      title: "Identity",
      claim,
      finding:
        "The endpoint is declared but has never passed verification. The address resolves to nothing that answers.",
      verdict: "fail",
      score: 0.15,
      weight: WEIGHTS.identity,
      evidence,
    };
  }

  return {
    id: "identity",
    title: "Identity",
    claim,
    finding: "No endpoint of any kind. This registration points nowhere.",
    verdict: "fail",
    score: 0,
    weight: WEIGHTS.identity,
    evidence,
  };
}

// ---------------------------------------------------------------------------
// 2. Custody, is it self-custodial, or wearing its owner's wallet?
// ---------------------------------------------------------------------------

function custodyAssay(ctx: AssayContext): AssayResult {
  /*
    A session with an allowlist is a stronger arrangement than a second
    wallet, and it is the one our reference agents actually use: they hold no
    wallet, they act on the principal's account through a key that may call
    four selectors on a contract which can only pay the principal back.
  */
  const leash = ctx.house?.leash;
  if (leash) {
    const expiry = new Date(leash.expiry * 1000).toISOString().slice(0, 16).replace("T", " ");
    return {
      id: "custody",
      title: "Custody",
      claim: "Acts on the owner's account through a session key.",
      finding: leash.live
        ? `Holds no wallet of its own. It acts on ${ctx.house!.operating} through a session restricted to ${leash.calls.join(", ")}, capped at ${leash.caps}, expiring ${expiry} UTC${leash.registered ? " and registered in the KeyStore" : " (not registered on chain)"}. It cannot move funds anywhere but back to the owner.`
        : `Holds no wallet of its own and acts only through a session on ${ctx.house!.operating}, restricted to ${leash.calls.join(", ")} and capped at ${leash.caps}. That session expired ${expiry} UTC, so it holds no authority at all right now: nothing can be run through it until it is granted again.`,
      verdict: leash.live && leash.registered ? "pass" : "inconclusive",
      score: leash.live && leash.registered ? 1 : 0.4,
      weight: WEIGHTS.custody,
      evidence: [
        { kind: "address", label: "Account it acts on", value: ctx.house!.operating, url: addressUrl(ctx.house!.operating) },
        ...leash.calls.slice(0, 4).map((c) => ({ kind: "note" as const, label: "Allowed call", value: c })),
        { kind: "note", label: "Daily cap", value: leash.caps },
        { kind: "note", label: "Session", value: leash.live ? "live" : "expired, so it can act on nothing until renewed" },
        { kind: "note", label: "KeyStore key id", value: leash.keyId },
      ],
    };
  }

  /*
    An agent that sells answers takes custody of nothing. Asking whether its
    custody is separated is asking a question that does not apply, and
    scoring it zero for that would say something false about it.
  */
  const sellsReads = (ctx.firsthand?.delivered.length ?? 0) > 0 && !ctx.house;
  if (sellsReads) {
    return {
      id: "custody",
      title: "Custody",
      claim: "Sells answers per call.",
      finding: `It has answered ${ctx.firsthand!.delivered.length} paid call${ctx.firsthand!.delivered.length === 1 ? "" : "s"} for us and never held anything of ours: payment goes to it, the answer comes back, and no authority over a buyer's funds is granted at any point. There is no custody here to separate.`,
      verdict: "inconclusive",
      notApplicable: true,
      score: 0,
      weight: WEIGHTS.custody,
      evidence: ctx.firsthand!.delivered.slice(0, 2).flatMap((c) => (c.tx ? [{ kind: "tx" as const, label: `Paid ${c.at.slice(0, 10)}`, value: c.tx, url: txUrl(c.tx) }] : [])),
    };
  }

  const d = ctx.detail;
  const wallet = d.agent_wallet?.toLowerCase() ?? null;
  const owner = d.owner_address?.toLowerCase() ?? null;
  const evidence: Evidence[] = [];

  if (wallet) {
    evidence.push({
      kind: "address",
      label: "Agent wallet",
      value: wallet,
      url: addressUrl(wallet),
    });
  }
  if (owner) {
    evidence.push({
      kind: "address",
      label: "Owner",
      value: owner,
      url: addressUrl(owner),
    });
  }

  if (!wallet) {
    return {
      id: "custody",
      title: "Custody",
      claim: "Registered as an autonomous agent.",
      finding: "No agent wallet is declared. It cannot hold or spend anything.",
      verdict: "fail",
      score: 0,
      weight: WEIGHTS.custody,
      evidence,
    };
  }

  if (owner && wallet === owner) {
    return {
      id: "custody",
      title: "Custody",
      claim: "Presented as a self-custodial agent with its own wallet.",
      finding:
        "The agent wallet is the owner's wallet, byte for byte. There is no separation of custody, the autonomy is a label, not an arrangement.",
      verdict: "fail",
      score: 0.2,
      weight: WEIGHTS.custody,
      evidence,
    };
  }

  return {
    id: "custody",
    title: "Custody",
    claim: "Presented as a self-custodial agent with its own wallet.",
    finding: "Agent wallet is distinct from the owner. Custody is genuinely separated.",
    verdict: "pass",
    score: 1,
    weight: WEIGHTS.custody,
    evidence,
  };
}

// ---------------------------------------------------------------------------
// 3. Activity, has it ever done anything at all?
// ---------------------------------------------------------------------------

function activityAssay(ctx: AssayContext): AssayResult {
  const w = ctx.wallet;
  const evidence: Evidence[] = [];
  if (ctx.house && w) {
    evidence.push({ kind: "note", label: "Measured on", value: `${w.address}, the demo account this agent acts on through a session; the registered wallet only signs registrations` });
  }

  if (!w) {
    return {
      id: "activity",
      title: "Activity",
      claim: "Runs continuously on BNB Smart Chain.",
      finding: "No wallet to inspect, so no activity can exist.",
      verdict: "fail",
      score: 0,
      weight: WEIGHTS.activity,
      evidence,
    };
  }

  evidence.push(
    {
      kind: "rpc",
      label: "eth_getTransactionCount",
      value: String(w.nonce),
      url: addressUrl(w.address),
    },
    {
      kind: "rpc",
      label: "eth_getBalance",
      value: `${bnb(w.balanceWei)} BNB`,
      url: addressUrl(w.address),
    },
  );

  if (w.nonce === 0) {
    return {
      id: "activity",
      title: "Activity",
      claim: "Runs continuously on BNB Smart Chain.",
      finding:
        "This wallet has never sent a transaction. Not once, since registration. It has never acted.",
      verdict: "fail",
      score: 0,
      weight: WEIGHTS.activity,
      evidence,
    };
  }

  // Graded: a handful of transactions is a deployment, not an operating agent.
  const score =
    w.nonce >= 200 ? 1 : w.nonce >= 50 ? 0.8 : w.nonce >= 10 ? 0.5 : w.nonce >= 5 ? 0.3 : 0.15;

  const funded = w.balanceWei > 0n;
  const finding =
    w.nonce < 5
      ? `Only ${w.nonce} transaction${w.nonce === 1 ? "" : "s"} in its entire history${funded ? "" : ", and it holds no BNB to send another"}. That is a deployment, not an operating agent.`
      : `${w.nonce} transactions sent, holding ${bnb(w.balanceWei)} BNB. Genuinely active.`;

  return {
    id: "activity",
    title: "Activity",
    claim: "Runs continuously on BNB Smart Chain.",
    finding,
    verdict: score >= 0.5 ? "pass" : "fail",
    // An unfunded wallet cannot continue acting, whatever its history.
    score: funded ? score : Math.min(score, 0.3),
    weight: WEIGHTS.activity,
    evidence,
  };
}

// ---------------------------------------------------------------------------
// 4. Capability, does the chain agree with the category it claims?
// ---------------------------------------------------------------------------

async function capabilityAssay(ctx: AssayContext): Promise<AssayResult> {
  const category = ctx.classification.category;
  const label = category ? CATEGORY_LABEL[category] : null;
  const evidence: Evidence[] = [];

  if (ctx.classification.matched.length) {
    // Most agents are classified from the words on their own card. Ours are
    // classified from the registration we made, and the label says which.
    evidence.push({
      kind: "note",
      label: ctx.house ? "Category" : "Classified from its own words",
      value: ctx.classification.matched.join(", "),
    });
  }

  if (!category) {
    return {
      id: "capability",
      title: "Capability",
      claim: "Describes itself without naming any of the four market functions.",
      finding:
        "Nothing in the agent's own description matches rebalancing, grid trading, yield optimisation or health factor monitoring. There is no capability claim to test.",
      verdict: "inconclusive",
      score: 0,
      weight: WEIGHTS.capability,
      evidence,
    };
  }

  const claim = `Claims to perform ${label}.`;

  // A wallet that has never sent a transaction cannot have touched a protocol.
  // This settles the assay without scanning a single block.
  if (!ctx.wallet || ctx.wallet.nonce === 0) {
    return {
      id: "capability",
      title: "Capability",
      claim,
      finding: `Nonce is zero, so no interaction with any ${label} contract is possible. The claim is unsupported by construction.`,
      verdict: "fail",
      score: 0,
      weight: WEIGHTS.capability,
      evidence,
      proven: { protocols: [], complete: true, scannedBlocks: "0" },
    };
  }

  const expected = CATEGORY_EVIDENCE[category as Category];
  const { touches, scannedBlocks, complete } = await findProtocolTouches(
    ctx.wallet.address,
    expected,
    {
      eventProbes: CATEGORY_EVENT_PROBES[category as Category],
      // Deliberately narrower than the window a grant uses. This runs while
      // someone watches a page, and the finding text always names the number
      // of blocks searched, so a shorter search is reported rather than hidden.
      lookbackBlocks: 30_000n,
    },
  );

  evidence.push({
    kind: "note",
    label: "Contracts required by this category",
    value: expected.map((a) => PROTOCOL_LABEL[a] ?? a).join(", "),
  });
  evidence.push({
    kind: "block",
    label: "Recent blocks scanned",
    value: scannedBlocks.toLocaleString(),
  });

  if (touches.length === 0) {
    // A scan the provider refused is unknown, never exculpatory and never
    // damning. Only a clean, complete scan is allowed to fail an agent.
    if (!complete) {
      evidence.push({
        kind: "note",
        label: "Scan coverage",
        value: "Incomplete, the RPC provider refused part of the range",
      });
      return {
        id: "capability",
        title: "Capability",
        claim,
        finding: `The window could not be scanned completely, so the ${label} claim is recorded as untested rather than unsupported.`,
        verdict: "inconclusive",
        score: 0,
        weight: WEIGHTS.capability,
        evidence,
        proven: { protocols: [], complete: false, scannedBlocks: scannedBlocks.toString() },
      };
    }
    /*
      Our own agents act through a session: the transaction is sent by the
      relay, to a leash contract, so a scan of the account for protocol
      touches finds nothing however much it has done. What it did is on
      chain all the same, and that is what is shown.
    */
    const acts = ctx.house?.actions ?? [];
    if (acts.length) {
      for (const a of acts.slice(0, 4)) evidence.push({ kind: "tx", label: a.label, value: a.tx, url: txUrl(a.tx) });
      const when = acts.find((a) => a.at)?.at?.slice(0, 10);
      return {
        id: "capability",
        title: "Capability",
        claim,
        finding: `${acts.length} on-chain action${acts.length === 1 ? "" : "s"} through its leash contract${when ? `, most recently ${when}` : ""}, outside the ${scannedBlocks.toLocaleString()} block window this scan covers. It acts through a session, so the transactions are sent by the relay to the leash rather than by this wallet to the protocol.`,
        verdict: "pass",
        score: 0.8,
        weight: WEIGHTS.capability,
        evidence,
        proven: { protocols: [], complete: true, scannedBlocks: scannedBlocks.toString() },
      };
    }

    /*
      An agent that only reads never sends the protocol a transaction, so the
      window is empty for it however good it is. Its capability is tested a
      different way: a paid answer of its, checked against our own reading of
      the same fact. Agreement is the claim proven; disagreement is the claim
      failed; an answer nothing on chain states is neither.
    */
    const answers = ctx.firsthand?.answers ?? [];
    const agreed = answers.filter((a) => a.agrees === true);
    const wrong = answers.filter((a) => a.agrees === false);
    for (const a of answers.slice(0, 3)) {
      evidence.push({ kind: a.tx ? "tx" : "note", label: `Paid answer: ${a.what}`, value: a.tx ?? a.detail, ...(a.tx ? { url: txUrl(a.tx) } : {}) });
      if (a.tx) evidence.push({ kind: "note", label: "Checked against the chain", value: a.detail });
    }
    if (agreed.length && !wrong.length) {
      return {
        id: "capability",
        title: "Capability",
        claim,
        finding: `No transaction with a ${label} contract in the last ${scannedBlocks.toLocaleString()} blocks, because this agent reads rather than trades. We checked its paid answer${agreed.length === 1 ? "" : "s"} about ${agreed[0].what} and it stands up: ${agreed[0].detail}. The claim is tested and holds.`,
        verdict: "pass",
        score: Math.min(1, 0.6 + agreed.length * 0.15),
        weight: WEIGHTS.capability,
        evidence,
        proven: { protocols: [], complete: true, scannedBlocks: scannedBlocks.toString() },
      };
    }
    if (wrong.length) {
      return {
        id: "capability",
        title: "Capability",
        claim,
        finding: `No transaction with a ${label} contract in the window, and a paid answer of its did not agree with the chain: ${wrong[0].what}, ${wrong[0].detail}.`,
        verdict: "fail",
        score: 0,
        weight: WEIGHTS.capability,
        evidence,
        proven: { protocols: [], complete: true, scannedBlocks: scannedBlocks.toString() },
      };
    }
    if (answers.length) {
      return {
        id: "capability",
        title: "Capability",
        claim,
        finding: `No transaction with a ${label} contract in the window. It has answered our paid calls, but nothing on chain states what it answered, so the claim is recorded as untested rather than unsupported.`,
        verdict: "inconclusive",
        score: 0,
        weight: WEIGHTS.capability,
        evidence,
        proven: { protocols: [], complete: true, scannedBlocks: scannedBlocks.toString() },
      };
    }
    return {
      id: "capability",
      title: "Capability",
      claim,
      finding: `No interaction with any ${label} contract across the last ${scannedBlocks.toLocaleString()} blocks, about ${(Number(scannedBlocks) * 0.75 / 3600).toFixed(1)} hours. An agent that trades continuously would have left a trace in that window; one that acts occasionally, or only reads, need not have, and we hold no paid answer from it to check instead.`,
      verdict: "fail",
      score: 0,
      weight: WEIGHTS.capability,
      evidence,
      proven: { protocols: [], complete: true, scannedBlocks: scannedBlocks.toString() },
    };
  }

  for (const t of touches.slice(0, 5)) {
    evidence.push({
      kind: "tx",
      label: PROTOCOL_LABEL[t.protocol] ?? "Protocol interaction",
      value: t.txHash,
      url: txUrl(t.txHash),
    });
  }

  const provenProtocols = [...new Set(touches.map((t) => t.protocol.toLowerCase()))];
  const distinct = provenProtocols.length;
  const score = Math.min(1, 0.55 + distinct * 0.15 + Math.min(touches.length, 10) * 0.03);

  return {
    id: "capability",
    title: "Capability",
    claim,
    finding: `${touches.length} verified interaction${touches.length === 1 ? "" : "s"} with ${distinct} ${label} contract${distinct === 1 ? "" : "s"} in the last ${scannedBlocks.toLocaleString()} blocks. The chain agrees with the claim.`,
    verdict: "pass",
    score,
    weight: WEIGHTS.capability,
    evidence,
    proven: { protocols: provenProtocols, complete, scannedBlocks: scannedBlocks.toString() },
  };
}

// ---------------------------------------------------------------------------
// 5. Reputation, is the feedback organic, or manufactured?
// ---------------------------------------------------------------------------

function reputationAssay(ctx: AssayContext): AssayResult {
  const raw = ctx.feedbacks.length;
  const evidence: Evidence[] = [];

  /*
    First hand before hearsay. What happened when we paid it is reputation we
    can vouch for, and it is entered before any star anyone else left.
  */
  const own = ctx.firsthand?.calls ?? null;
  if (own) {
    evidence.push({
      kind: "note",
      label: "When we paid it",
      value: `${own.delivered} answered, ${own.paidNotDelivered} took the money and failed, ${own.refused} refused a correct payment`,
    });
    if (own.lastTx) evidence.push({ kind: "tx", label: "Last settlement", value: own.lastTx, url: txUrl(own.lastTx) });
    if (own.lastWhy) evidence.push({ kind: "note", label: "Its last failure, in its words", value: own.lastWhy.slice(0, 200) });
  }
  const firsthandVerdict = (): AssayResult | null => {
    if (!own) return null;
    const failures = own.paidNotDelivered + own.refused;
    if (own.delivered > 0 && failures === 0) {
      const score = Math.min(0.9, 0.3 + own.delivered * 0.15);
      return {
        id: "reputation",
        title: "Reputation",
        claim: raw ? `Registry reports ${raw} feedback records.` : "No reputation claimed.",
        finding: `${raw ? `${raw} registry records, and ` : "No registry feedback, but "}first hand: we paid it ${own.delivered} time${own.delivered === 1 ? "" : "s"} and it answered every time.`,
        verdict: score >= 0.5 ? "pass" : "inconclusive",
        score,
        weight: WEIGHTS.reputation,
        evidence,
      };
    }
    if (failures > 0 && own.delivered === 0) {
      return {
        id: "reputation",
        title: "Reputation",
        claim: raw ? `Registry reports ${raw} feedback records.` : "No reputation claimed.",
        finding: `First hand: ${own.paidNotDelivered ? `it took our payment ${own.paidNotDelivered} time${own.paidNotDelivered === 1 ? "" : "s"} and answered with an error` : "it refused a correctly signed payment"}. ${own.lastWhy ? `Its words: ${own.lastWhy.slice(0, 160)}` : ""}`,
        verdict: "fail",
        score: 0,
        weight: WEIGHTS.reputation,
        evidence,
      };
    }
    return null;
  };

  if (raw === 0) {
    const fromUs = firsthandVerdict();
    if (fromUs) return fromUs;
    const unread = ctx.feedbacksRead === false;
    return {
      id: "reputation",
      title: "Reputation",
      claim: ctx.detail.total_feedbacks
        ? `Registry reports ${ctx.detail.total_feedbacks} feedback records.`
        : "No reputation claimed.",
      finding: unread
        ? "The feedback corpus could not be read, the index did not answer in time, so nothing is said about this agent's reputation either way."
        : "No feedback records to examine. There is no reputation here to trust or distrust.",
      verdict: "inconclusive",
      score: 0,
      weight: WEIGHTS.reputation,
      evidence,
    };
  }

  const s = ctx.sybil;
  const clean = s ? s.cleanCount : raw;
  const flagged = raw - clean;

  evidence.push({ kind: "api", label: "Feedback records on chain", value: String(raw) });
  if (s) {
    evidence.push({
      kind: "note",
      label: "Reviewers flagged as coordinated",
      value: `${s.flaggedReviewers.length} of ${s.reviewerCount}`,
    });
    for (const r of s.reasons.slice(0, 4)) {
      evidence.push({ kind: "note", label: "Signal", value: r });
    }
    for (const f of ctx.feedbacks.slice(0, 3)) {
      if (f.transaction_hash) {
        evidence.push({
          kind: "tx",
          label: `Feedback from ${short(f.user_address)}`,
          value: f.transaction_hash,
          url: txUrl(f.transaction_hash),
        });
      }
    }
  }

  // Distinct *unflagged* reviewers, which is the only thing that carries
  // information. Twenty records from one wallet is one opinion, not twenty.
  const cleanReviewers = new Set(
    ctx.feedbacks
      .map((f) => f.user_address?.toLowerCase())
      .filter((a): a is string => Boolean(a) && !s?.flags[a!]?.length),
  ).size;

  // Thin evidence must not read as clean evidence. Confidence saturates as
  // independent reviewers accumulate: 1 → 0.28, 3 → 0.63, 8 → 0.93.
  const confidence = 1 - Math.exp(-cleanReviewers / 3);
  const purity = raw === 0 ? 0 : clean / raw;
  const score = purity * confidence;

  evidence.push({
    kind: "note",
    label: "Independent reviewers",
    value: `${cleanReviewers} distinct wallet${cleanReviewers === 1 ? "" : "s"} after cleaning`,
  });

  const base =
    flagged === 0
      ? `${raw} feedback record${raw === 1 ? "" : "s"}, none matching a coordination signature.`
      : `${flagged} of ${raw} feedback records come from wallets showing coordinated behaviour. ${clean === 0 ? "Removing them leaves no reputation at all." : `Only ${clean} survive.`}`;

  const thin =
    cleanReviewers > 0 && cleanReviewers < 4
      ? ` They come from ${cleanReviewers} wallet${cleanReviewers === 1 ? "" : "s"}, which is too few to constitute a reputation whether or not it is honest.`
      : "";

  return {
    id: "reputation",
    title: "Reputation",
    claim: `Registry reports ${ctx.detail.total_feedbacks ?? raw} feedback records and a score of ${ctx.detail.average_score ?? 0}.`,
    finding: base + thin,
    verdict: score >= 0.5 ? "pass" : "fail",
    score,
    weight: WEIGHTS.reputation,
    evidence,
  };
}

// ---------------------------------------------------------------------------
// 6. Performance, did it beat doing nothing?
// ---------------------------------------------------------------------------

function performanceAssay(ctx: AssayContext): AssayResult {
  const w = ctx.wallet;
  const evidence: Evidence[] = [];

  /*
    A seller of answers has a performance record the moment it is paid: did
    the answer come, how fast, and did it agree with the chain. That is the
    return on a paid call, and it is measured here for any agent we have paid.
  */
  if (ctx.house?.performance) {
    const hp = ctx.house.performance;
    return {
      id: "performance",
      title: "Performance",
      claim: "Runs a position on the demo account through a session.",
      finding: hp.finding,
      verdict: hp.verdict,
      score: hp.verdict === "pass" ? 0.8 : 0,
      weight: WEIGHTS.performance,
      evidence: hp.evidence.map((e) => ({ kind: e.url ? ("tx" as const) : ("note" as const), label: e.label, value: e.value, ...(e.url ? { url: e.url } : {}) })),
    };
  }

  const fh = ctx.firsthand;
  if (fh?.delivered.length) {
    const ms = fh.delivered.map((c) => c.ms).filter((n) => n > 0).sort((a, b) => a - b);
    const median = ms.length ? ms[Math.floor(ms.length / 2)] : null;
    const checked = fh.answers.filter((a) => a.agrees !== null);
    const agreed = checked.filter((a) => a.agrees === true);
    evidence.push({ kind: "note", label: "Paid calls answered", value: `${fh.delivered.length}${median ? `, median ${(median / 1000).toFixed(1)} s` : ""}` });
    for (const c of fh.delivered.slice(0, 3)) if (c.tx) evidence.push({ kind: "tx", label: `Settled ${c.at.slice(0, 10)}`, value: c.tx, url: txUrl(c.tx) });
    for (const a of checked.slice(0, 3)) evidence.push({ kind: "note", label: a.agrees ? "Checked and stands up" : "Checked and does not stand up", value: `${a.what}: ${a.detail}` });
    const failed = fh.calls ? fh.calls.paidNotDelivered + fh.calls.refused : 0;
    if (checked.length && agreed.length === checked.length && failed === 0) {
      return {
        id: "performance",
        title: "Performance",
        claim: "Sells answers per call.",
        finding: `${fh.delivered.length} paid call${fh.delivered.length === 1 ? "" : "s"} answered${median ? `, median ${(median / 1000).toFixed(1)} seconds` : ""}; ${agreed.length} of ${checked.length} checked answer${checked.length === 1 ? "" : "s"} stood up when we checked ${checked.length === 1 ? "it" : "them"}. It does what it is paid for.`,
        verdict: "pass",
        score: Math.min(1, 0.5 + agreed.length * 0.15),
        weight: WEIGHTS.performance,
        evidence,
      };
    }
    if (checked.length && agreed.length < checked.length) {
      return {
        id: "performance",
        title: "Performance",
        claim: "Sells answers per call.",
        finding: `${fh.delivered.length} paid calls answered, but ${checked.length - agreed.length} of ${checked.length} checked answers did not stand up.`,
        verdict: "fail",
        score: 0,
        weight: WEIGHTS.performance,
        evidence,
      };
    }
    return {
      id: "performance",
      title: "Performance",
      claim: "Sells answers per call.",
      finding: `${fh.delivered.length} paid call${fh.delivered.length === 1 ? "" : "s"} answered${median ? `, median ${(median / 1000).toFixed(1)} seconds` : ""}. Nothing on chain states what it answered, so the answers are unchecked: reported as delivered, not as right.`,
      verdict: "inconclusive",
      score: 0.3,
      weight: WEIGHTS.performance,
      evidence,
    };
  }
  if (fh?.calls && fh.calls.delivered === 0 && fh.calls.paidNotDelivered + fh.calls.refused > 0) {
    return {
      id: "performance",
      title: "Performance",
      claim: "Sells answers per call.",
      finding: `Paid, and nothing came back: ${fh.calls.paidNotDelivered} settled payment${fh.calls.paidNotDelivered === 1 ? "" : "s"} answered with an error${fh.calls.refused ? `, ${fh.calls.refused} correct payment${fh.calls.refused === 1 ? "" : "s"} refused` : ""}.`,
      verdict: "fail",
      score: 0,
      weight: WEIGHTS.performance,
      evidence,
    };
  }

  if (!w || w.nonce === 0) {
    return {
      id: "performance",
      title: "Performance",
      claim: "Implies a return on the capital it manages.",
      finding:
        "No transactions, so no position was ever taken and no return exists to measure against holding.",
      verdict: "inconclusive",
      score: 0,
      weight: WEIGHTS.performance,
      evidence,
    };
  }

  evidence.push({
    kind: "address",
    label: "Wallet under measurement",
    value: w.address,
    url: addressUrl(w.address),
  });

  // Verified alpha requires a priced position history. Phase 5 wires this to
  // real settlement data for agents we operate; for third-party agents with
  // sparse history there is nothing honest to report yet.
  return {
    id: "performance",
    title: "Performance",
    claim: "Implies a return on the capital it manages.",
    finding:
      "Insufficient settled position history to compute a return against a hold counterfactual. Reported as unmeasured rather than estimated.",
    verdict: "inconclusive",
    score: 0,
    weight: WEIGHTS.performance,
    evidence,
  };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export type AssayProgress = (event: {
  stage: string;
  index: number;
  total: number;
  result?: AssayResult;
}) => void;

/** Races a registry read against the interactive path's patience. */
function withDeadline<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    work,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${what} within ${Math.round(ms / 1000)}s`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export async function assayAgent(
  chainId: number,
  tokenId: string,
  onProgress?: AssayProgress,
  options: { registryDeadlineMs?: number } = {},
): Promise<AssayReport> {
  const started = Date.now();
  const TOTAL = 6;

  onProgress?.({ stage: "Reading registry claim", index: 0, total: TOTAL });

  /*
    The registry read gets a deadline on the interactive path.

    The scan client retries a `DATABASE_ERROR` four times with backoff through
    a queue spaced at twenty-five requests a minute, which is right for a
    background sweep and wrong for a page somebody is watching: during an
    upstream outage it left six bars pulsing "running" for twenty-seven seconds
    before saying anything. The CLI passes no deadline and keeps the patient
    path, because there the retries usually win.
  */
  const deadline = options.registryDeadlineMs;
  const detail = deadline
    ? await withDeadline(
        getAgent(chainId, tokenId),
        deadline,
        "the ERC-8004 index did not answer",
      )
    : await getAgent(chainId, tokenId);

  let classification = classify({
    name: detail.name,
    description: detail.description,
    skills: extractSkills(detail.services),
    tags: detail.tags,
  });
  /*
    The explorer's copy of a card can be empty or stale; ours was read from
    the registration itself. When the explorer's words name no job, the words
    we hold are tried, and failing that the category the index filed it under.
  */
  if (!classification.category) {
    const own = getAgentIndex().agents.find((a) => a.tokenId === tokenId);
    if (own) {
      const again = classify({ name: own.name ?? detail.name, description: own.description ?? detail.description, skills: [], tags: detail.tags });
      classification = again.category
        ? again
        : own.category
          ? { ...again, category: own.category as Category, confidence: own.confidence, matched: ["filed under this category in the index, from its registration"] }
          : classification;
    }
  }

  onProgress?.({ stage: "Resolving wallet on chain", index: 1, total: TOTAL });
  // Our own reference agents act through a session on the demo account, so
  // that is the wallet whose activity and protocol interactions are measured.
  const house = await houseFacts(tokenId).catch(() => null);
  /*
    For our own reference agents the category is not a guess. Yield-1 was
    classified as health-factor monitoring because its card mentions Venus,
    and then failed a capability check against Venus lending contracts it was
    never meant to call. We registered these four ourselves, one per category,
    so the registration is the answer and word matching is not consulted.
  */
  const houseCategory = house ? referenceBySlug(house.slug)?.category : null;
  if (houseCategory && classification.category !== houseCategory) {
    classification = { ...classification, category: houseCategory, confidence: 1, matched: ["registered by us as the reference agent for this category"] };
  }
  const walletAddr = house?.operating ?? detail.agent_wallet;
  const wallet = isAddress(walletAddr) ? await getWalletFacts(walletAddr) : null;

  onProgress?.({ stage: "Collecting feedback records", index: 2, total: TOTAL });

  /*
    The feedback walk gets the same deadline, but failing it is not fatal.

    Five of the six dimensions need nothing from the corpus, so an index that
    stalls here costs one inconclusive verdict rather than the whole assay.
    `feedbacksRead` carries the distinction into the result: an empty list
    because there are no reviews, and an empty list because nobody answered,
    are different findings.
  */
  let feedbacksRead = true;
  const feedbacks = deadline
    ? await withDeadline(
        collectFeedbacks(chainId, tokenId),
        deadline,
        "the feedback index did not answer",
      ).catch(() => {
        feedbacksRead = false;
        return [] as ScanFeedback[];
      })
    : await collectFeedbacks(chainId, tokenId);

  const sybil = feedbacks.length
    ? await (deadline
        ? withDeadline(
            assessFeedback(chainId, tokenId, feedbacks, detail),
            deadline,
            "the registry-wide sample did not answer",
          ).catch(() => null)
        : assessFeedback(chainId, tokenId, feedbacks, detail))
    : null;

  onProgress?.({ stage: "Reading what we know first hand", index: 2, total: TOTAL });
  const firsthand = (await withTimeout(firstHand(tokenId).catch(() => undefined), deadline ? Math.min(deadline, 12_000) : 12_000)) ?? undefined;
  const ctx: AssayContext = { detail, classification, wallet, feedbacks, sybil, feedbacksRead, firsthand, house };

  const results: AssayResult[] = [];
  const run = async (
    stage: string,
    index: number,
    fn: () => AssayResult | Promise<AssayResult>,
  ) => {
    onProgress?.({ stage, index, total: TOTAL });
    const t0 = Date.now();
    const result = await fn();
    result.ms = Date.now() - t0;
    results.push(result);
    onProgress?.({ stage, index, total: TOTAL, result });
  };

  await run("Identity", 0, () => identityAssay(ctx));
  await run("Custody", 1, () => custodyAssay(ctx));
  await run("Activity", 2, () => activityAssay(ctx));
  await run("Capability", 3, () => capabilityAssay(ctx));
  await run("Reputation", 4, () => reputationAssay(ctx));
  await run("Performance", 5, () => performanceAssay(ctx));

  const fineness = computeFineness(results);

  return {
    chainId,
    tokenId,
    agentId: detail.agent_id,
    name: detail.name,
    ownerAddress: detail.owner_address,
    agentWallet: detail.agent_wallet,
    registryScore: detail.total_score,
    fineness,
    hallmark: hallmarkFor(fineness),
    category: classification.category,
    categoryConfidence: classification.confidence,
    results,
    assayedAt: new Date().toISOString(),
    ms: Date.now() - started,
  };
}

async function collectFeedbacks(chainId: number, tokenId: string) {
  const out: ScanFeedback[] = [];
  for (let offset = 0; offset < 500; offset += 100) {
    const page = await listFeedbacks({ chainId, agentTokenId: tokenId, limit: 100, offset });
    const items = page.items ?? [];
    out.push(...items);
    if (items.length < 100) break;
  }
  return out;
}

const short = (a: string | null | undefined) =>
  a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "unknown";

const host = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

export { WEIGHTS };
