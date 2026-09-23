/**
 * The Definition of Done, computed rather than claimed.
 *
 * The plan's §15 is a list of fourteen sentences that are either true of this
 * deployment or not. Printing them as a tick-list a human maintains would make
 * them marketing; every box here is therefore derived from something the site
 * can read at request time: a census age, a settled transaction, a contract
 * owner, a route that exists. A box we cannot compute says so and stays open.
 *
 * Red boxes are the point. A judge should be able to open /status and see
 * exactly what is not finished, in our own words, before they find it
 * themselves.
 */

import { censusAge, listings } from "@/lib/market/listing";
import { hirePath } from "@/lib/market/hire-law";
import { listPaidCalls, paidCallsFromFile, settledByCategory } from "@/lib/market/paid-calls";
import { strangerHires } from "@/lib/market/stranger-hires";
import { readLadder, type Rung } from "@/lib/ladder";
import { uptime } from "@/lib/ops/history";
import { listSessions } from "@/lib/chain/session-store";
import { CATEGORIES, CATEGORY_LABEL, type Category } from "@/lib/config";
import { allowance, judgeModeOn } from "@/lib/market/judge-mode";
import { memo, withTimeout } from "@/lib/cache";
import { houseActivity } from "@/lib/house/runs";
import { HOUSE_CADENCE_MIN, houseLive } from "@/lib/house/run";
import { PAUSED, pauseForSlug } from "@/lib/market/paused";
import { readAdvantage } from "@/lib/advantage/report";
import { rerunChecks } from "@/lib/advantage/rerun";
import { checkListing } from "@/lib/market/list-check";
import { poolGapProgress, poolGapReading, CADENCE_MS } from "@/lib/pancake/pool-gap";
import { warm, snapshot } from "@/lib/data/snapshots";
import type { GridWindow } from "@/lib/grid/window";
import { referenceAgents } from "@/lib/market/reference";
import { isOurs } from "@/lib/market/judge";
import { referenceRegistrations } from "@/lib/house";
import { roles } from "@/lib/chain/marketV2";
import { marketClient } from "@/lib/chain/market";

export interface Box {
  id: string;
  /** The sentence from the plan, as it is written there. */
  claim: string;
  state: "done" | "partly" | "open";
  /** What was read to decide, in a sentence. */
  detail: string;
  /** Where to look. */
  link?: string;
}


/**
 * Every reading here is bounded and the whole list is memoised for a minute.
 *
 * The first version asked the chain, the database and the ladder for fresh
 * answers on every render, and /status, which already runs six live beats,
 * took longer than the function's whole budget and returned a timeout page.
 * A status page that cannot load is worse than a stale one, so each read has
 * a deadline and a fallback, and the page is allowed to say "not read".
 */
export function definitionOfDone(): Promise<Box[]> {
  return memo("definition-of-done", { freshMs: 60_000, staleMs: 10 * 60_000 }, build);
}

async function build(): Promise<Box[]> {
  /*
    The live checks start first and are awaited last, so the slowest of them,
    not their sum, is what they add to the job: the re-run, a /list check on
    one of our own agents with the stored assay, and the market's owner.
  */
  const rerunning = withTimeout(rerunChecks().catch(() => null), 15_000);
  const listing = withTimeout(checkListing(referenceRegistrations()["range-1"]?.tokenId ?? "344119", { liveAssay: false }).catch(() => null), 15_000);
  const owning = withTimeout(
    roles()
      .then(async (r) => ({ owner: r.owner, code: await marketClient.getCode({ address: r.owner }).catch(() => undefined) }))
      .catch(() => null),
    8_000,
  );
  const referencing = withTimeout(referenceAgents().catch(() => null), 8_000);
  // Warmed here, not left to whichever job ran first in the tick, so the reading stands on its own.
  await warm(["probe", "census", "assays", "pool-gap", "pool-gap-progress", "grid-window"]).catch(() => undefined);
  const all = listings();
  const hireable = all.filter((l) => hirePath(l).ok);
  const census = censusAge();
  /*
    The committed record is the floor. Reading it lives inside the same call
    that reaches for the database, so a slow database once discarded both and
    the page reported four jobs with no hire when three were on file.
  */
  const onFile = paidCallsFromFile();
  const merged = (await withTimeout(listPaidCalls().catch(() => []), 6_000)) ?? [];
  const paid = merged.length >= onFile.length ? merged : onFile;
  const jobs = strangerHires();
  const boxes: Box[] = [];

  // 1. A civilian can land, pick, understand, activate and revoke.
  boxes.push({
    id: "civilian",
    claim: "A user with zero Agent Studio knowledge can land, pick a job, understand, activate, revoke, with no dead end.",
    state: hireable.length > 0 ? "done" : "open",
    detail:
      hireable.length > 0
        ? `${hireable.length} agents can be hired today, each with a rail this site can settle; every agent that cannot be hired shows the reason in place of the button.`
        : "Nothing on the shelf can be hired right now, so the front door has nothing behind it.",
    link: "/agents?hireable=1",
  });

  // 2. Each job has a settled hire of an agent we do not operate.
  const settled = settledByCategory(paid);
  const byJob = CATEGORIES.map((c) => {
    const call = settled[c] ?? null;
    const job = jobs.find(
      (h) => (h as { category?: string }).category === c && (h as { delivery?: { hashMatches?: string | null } }).delivery?.hashMatches,
    );
    return { c, ok: Boolean(call || job), how: call ? `paid per call, ${call.tx?.slice(0, 10)}…` : job ? `ERC-8183 job ${job.jobId}, delivered` : "nothing yet" };
  });
  const doneJobs = byJob.filter((b) => b.ok).length;
  boxes.push({
    id: "four-jobs",
    claim: "All four jobs have at least one mainnet hire of an agent we do not operate, that delivered.",
    state: doneJobs === 4 ? "done" : doneJobs > 0 ? "partly" : "open",
    detail: byJob.map((b) => `${CATEGORY_LABEL[b.c as Category]}: ${b.how}`).join("; "),
    link: "/activity#paid",
  });

  // 3. The probe is live, on the protocols agents actually speak.
  /*
    Not the census stamp, which moves on every slice even when the slice is
    starving: the age of each callable agent's own reading. For a week the
    stamp said "3 minutes ago" while the newest reading of any agent that
    answers was a day and a half old.
  */
  const callable = all.filter((l) => l.probe?.endpoint);
  const ages = callable.map((l) => (Date.now() - Date.parse(l.probe!.at ?? "")) / 60_000).filter((m) => Number.isFinite(m));
  const oldest = ages.length ? Math.max(...ages) : null;
  const withinTwoHours = ages.filter((m) => m <= 120).length;
  const cycling = oldest !== null && oldest <= 6 * 60;
  // Readings taken by the protocol probe carry a protocol; older ones do not, until each agent is called again.
  const spoken = callable.filter((l) => l.probe?.protocol !== undefined);
  const said = (p: string) => spoken.filter((l) => l.probe?.protocol === p).length;
  const copies = all.filter((l) => l.copies > 1).length;
  const hireableSpoken = hireable.filter((l) => l.probe?.protocol !== undefined).length;
  boxes.push({
    id: "probe",
    claim: "Probe is live (15 minutes or less) on A2A and MCP; failures visible; clones badged.",
    state: cycling && oldest !== null && oldest <= 15 && spoken.length === callable.length && hireableSpoken === hireable.length ? "done" : cycling ? "partly" : "open",
    detail:
      `${withinTwoHours} of ${callable.length} agents with an endpoint were called in the last two hours; the oldest reading is ` +
      `${oldest === null ? "unknown" : oldest < 120 ? `${Math.round(oldest)} min` : `${(oldest / 60).toFixed(1)} h`} old` +
      `${census.minutes !== null ? ` (census stamp ${census.minutes} min ago)` : ""}. ` +
      `${spoken.length} of ${callable.length} have been read by the protocol probe so far: ${said("x402")} answered with a price, ${said("mcp")} over MCP, ${said("a2a")} over A2A, and ${said("http")} answered in no agent protocol. ` +
      `Every hireable agent's reading must come from the protocol probe: ${hireableSpoken} of ${hireable.length} do. ` +
      `Failures stay listed and dimmed. ${copies} listed registrations are copies of another's card, and /agents can show one per product.`,
    link: "/agents",
  });

  // 4. Funnel rungs are numbers or the word unknown.
  const rungs = (await withTimeout(readLadder().catch(() => null), 12_000)) ?? null;
  const nulls = rungs?.rungs.filter((r: Rung) => r.population === null).map((r: Rung) => r.name) ?? [];
  boxes.push({
    id: "funnel",
    claim: "Funnel rungs are numbers or `unknown`, never null-as-zero.",
    state: rungs ? (nulls.length ? "partly" : "done") : "open",
    detail: rungs
      ? nulls.length
        ? `${rungs.rungs.length - nulls.length} of ${rungs.rungs.length} rungs carry a number; ${nulls.join(" and ")} still answer null rather than the word unknown.`
        : `All ${rungs.rungs.length} rungs carry a number or the word unknown.`
      : "The ladder did not answer inside its deadline on this request.",
    link: "/api/v1/registry/funnel",
  });

  // 5. One-click sponsored stranger hire, no wallet.
  const sponsoredDelivered = paid.filter((c) => c.sponsored && c.delivered).length;
  const allow = (await withTimeout(allowance({ caller: "status" }).catch(() => null), 4_000)) ?? null;
  boxes.push({
    id: "sponsored",
    claim: "One-click sponsored stranger hire works without a wallet.",
    state: judgeModeOn() && allow?.sponsor ? (sponsoredDelivered > 0 ? "done" : "partly") : "open",
    detail: allow?.sponsor
      ? `Judge Mode pays from ${allow.sponsor.slice(0, 10)}…, ${allow.left} calls left today. ${sponsoredDelivered} sponsored calls have been paid and answered.`
      : "No sponsoring wallet is configured on this deployment.",
    link: "/agents/342377#sponsored",
  });

  // 6. The machine door.
  boxes.push({
    id: "machine-door",
    claim: "An A2A or MCP machine door hires from the same index.",
    // A route is part of this build or it is not. This used to look for src/app on disk, which a deployed function does not have.
    state: "partly",
    detail: "MCP is served over HTTP with the marketplace's tools, and our own agent card is published. The A2A router (/a2a/v1) that lets another agent negotiate and hire is not built yet.",
    link: "/api/mcp",
  });

  // 7. Altana: cap, expiry and revoke visible in the product.
  const sessions = (await withTimeout(listSessions().catch(() => []), 4_000)) ?? [];
  const live = sessions.filter((s) => !s.revokedAt && s.registered);
  boxes.push({
    id: "leash",
    claim: "Altana cap, expiry and revoke are visible in the product, with explorer transactions listed.",
    state: live.length ? "done" : sessions.length ? "partly" : "open",
    detail: `${sessions.length} sessions on record, ${live.length} live and registered in the KeyStore, each with its allowlist, cap, expiry and a revoke control on the desk.`,
    link: "/desk",
  });

  // Every house agent we have not paused holds a live leash; a paused one is left to lapse.
  const active = (Object.keys(HOUSE_CADENCE_MIN) as (keyof typeof HOUSE_CADENCE_MIN)[]).filter((slug) => !pauseForSlug(slug));
  const leashOf = (slug: string) =>
    sessions.filter((s) => s.id.startsWith(`house:${slug}:`) && !s.revokedAt && s.registered && s.expiry * 1000 > Date.now()).sort((a, b) => b.expiry - a.expiry)[0] ?? null;
  const leashes = active.map((slug) => ({ slug, s: leashOf(slug) }));
  const days = (expiry: number) => Math.floor((expiry * 1000 - Date.now()) / 86_400_000);
  boxes.push({
    id: "leashes",
    claim: "Every house agent we run holds a live leash, renewed before it lapses; a paused one is left to lapse.",
    state: leashes.every((l) => l.s) ? "done" : leashes.some((l) => l.s) ? "partly" : "open",
    detail: `${leashes.map((l) => (l.s ? `${l.slug} live for ${days(l.s.expiry)} more days` : `${l.slug} has no live leash`)).join("; ")}.${PAUSED.length ? ` ${PAUSED.map((x) => x.slug).join(", ")} paused and not renewed.` : ""}`,
    link: "/desk",
  });

  // 8. The house agents act on the site's own clock, not on the operator's machine.
  type Activity = Awaited<ReturnType<typeof houseActivity>>;
  const activity: Activity = (await withTimeout(houseActivity().catch((): Activity => ({})), 4_000)) ?? {};
  const named = (slug: string) => slug.replace(/^./, (c) => c.toUpperCase());
  const agents = (Object.keys(HOUSE_CADENCE_MIN) as (keyof typeof HOUSE_CADENCE_MIN)[]).filter((s) => !pauseForSlug(s));
  const seen = agents.map((slug) => {
    const last = activity[slug]?.last ?? null;
    const minutes = last ? Math.round((Date.now() - Date.parse(last.at)) / 60_000) : null;
    // Twice its cadence, and five minutes for the pinger's own interval.
    const fresh = minutes !== null && minutes <= HOUSE_CADENCE_MIN[slug] * 2 + 5;
    return { fresh, text: last ? `${named(slug)}, ${minutes} min ago: ${last.reason}` : `${named(slug)} has no run on record yet.` };
  });
  const allFresh = seen.length > 0 && seen.every((x) => x.fresh);
  boxes.push({
    id: "unattended",
    claim: "Agents run when we are asleep: the house agents look and act on the site's own clock, not the operator's machine.",
    state: allFresh && houseLive() ? "done" : seen.some((x) => x.fresh) ? "partly" : "open",
    detail:
      `${houseLive() ? "Live: they send their own transactions, inside their leashes." : "Dry: they decide and record what they would send, and send nothing, until HOUSE_AGENTS is live."} ` +
      seen.map((x) => x.text).join(" ") +
      (PAUSED.length ? ` ${PAUSED.map((x) => named(x.slug)).join(", ")} paused.` : ""),
    link: "/desk",
  });

  // 9. The proof lab: locked tasks with raw outputs, both ways, and live re-runs that answer.
  const lab = readAdvantage();
  const rerun = await rerunning;
  const raw = lab?.tasks.filter((t) => t.result).length ?? 0;
  const both = Boolean(lab?.tasks.some((t) => /grid/i.test(t.category)) && lab?.tasks.some((t) => /security/i.test(t.category)));
  const reran = rerun ? rerun.checks.filter((c) => c.verdict === "pass").length : 0;
  boxes.push({
    id: "proof",
    claim: "/proof has three or more both-way tasks with raw outputs, trading and security present, and its live re-runs answer.",
    state: lab && raw >= 3 && both && rerun && reran === rerun.checks.length ? "done" : lab && raw >= 3 ? "partly" : "open",
    detail: lab
      ? `${raw} of ${lab.tasks.length} locked tasks carry their raw measurement (${lab.counts.win} won, ${lab.counts.loss} lost, ${lab.counts.mixed} mixed)${both ? ", trading and security among them" : ""}. ` +
        (rerun ? `The live re-run answered at block ${rerun.block ?? "unknown"}: ${reran} of ${rerun.checks.length} checks passed.` : "The live re-run did not answer inside its deadline on this reading.")
      : "The locked results could not be read on this deployment.",
    link: "/proof",
  });

  // 10. Grid-1 earns its place or stands down, with the loss in public.
  const grid = snapshot<GridWindow>("grid-window")?.payload ?? null;
  const gridPause = pauseForSlug("grid-1");
  boxes.push({
    id: "grid-1",
    claim: "Grid-1 is profitable, or paused with its loss public.",
    state: grid && grid.pnlUsd >= 0 ? "done" : grid && gridPause ? "done" : "open",
    detail: grid
      ? grid.pnlUsd >= 0
        ? `Its window beat holding by $${grid.pnlUsd.toFixed(3)}, net of gas.`
        : gridPause
          ? `Its window lost $${(-grid.pnlUsd).toFixed(3)} to holding, $${grid.gasUsd.toFixed(3)} of it gas. Paused since ${gridPause.since}, refused by the hire law on every rail, and the loss is printed on /proof.`
          : `Its window lost $${(-grid.pnlUsd).toFixed(3)} to holding and it is still offered for hire.`
      : "No trading window has been read.",
    link: "/proof",
  });

  // 11. PancakeSwap's pool gaps, measured on the clock.
  const gaps = poolGapReading();
  const reading = poolGapProgress();
  const gapAge = gaps ? (Date.now() - Date.parse(gaps.capturedAt)) / 3_600_000 : null;
  boxes.push({
    id: "pool-gap",
    claim: "The PancakeSwap pool-gap reading is at most a day old and says what it does not claim.",
    state: gapAge !== null && gapAge <= (CADENCE_MS * 2) / 3_600_000 ? "done" : gaps || reading ? "partly" : "open",
    detail: gaps
      ? `Published ${gapAge!.toFixed(1)} h ago from ${gaps.payload.swaps.toLocaleString("en-GB")} swaps over blocks ${gaps.payload.from} to ${gaps.payload.to}.${reading ? ` A new window is being read, ${reading.cursor - reading.from} of ${reading.to - reading.from + 1} blocks in.` : ""}`
      : reading
        ? `The first window is being read: ${reading.cursor - reading.from} of ${reading.to - reading.from + 1} blocks, ${reading.swaps.toLocaleString("en-GB")} swaps so far.`
        : "No window has been read yet.",
    link: "/pool-gaps",
  });

  // True only once a recenter with real minimums has landed, not because the code now sends them.
  const bounded = activity["range-1"]?.action?.outcome === "acted" && activity["range-1"]?.action?.readings?.bounded === true ? activity["range-1"]!.action! : null;
  boxes.push({
    id: "pancake",
    claim: "The Pancake path uses a non-zero minimum out, the recipient is the hirer, and the receipt is public.",
    state: bounded ? "done" : "open",
    detail: bounded
      ? `Range-1 recentered through RecipientBound with a bound on the withdrawal and a price bound on the mint, ${bounded.txs.map((t) => `${t.step} ${t.tx.slice(0, 10)}…`).join(", ")}, and the account owned every position throughout.`
      : "RecipientBound makes the hirer the only possible recipient. The first recenter passed zero as both minimum amounts; Range-1 now sends a 2% bound on the withdrawal and a price bound on the mint, and this turns green when its first bounded recenter lands.",
    link: "/desk",
  });
  boxes.push({
    id: "greenfield",
    claim: "Assays are on Greenfield and receipts are sealed on opBNB.",
    state: "open",
    detail: "The Greenfield bucket holds settlement objects only and the account needs funding; there is no opBNB code yet.",
  });
  const owner = await owning;
  // An EIP-7702 account carries a delegation designator (0xef0100 and an address) as its code. It is still one key.
  const delegated = Boolean(owner?.code?.toLowerCase().startsWith("0xef0100"));
  const byContract = Boolean(owner?.code && owner.code !== "0x" && !delegated);
  boxes.push({
    id: "multisig",
    claim: "A multisig owns the treasury and the contracts.",
    state: owner ? (byContract ? "partly" : "open") : "open",
    detail: owner
      ? byContract
        ? `The market's owner, ${owner.owner}, is a contract. Whether it is the prepared Safe, and who signs it, is checked on the desk.`
        : `The market's owner, ${owner.owner}, is one key${delegated ? ", an account whose only code is an EIP-7702 delegation" : ""}. A 2-of-2 Safe with the operator and a second signer is prepared, and moving ownership to it needs the second signer.`
      : "The market's owner was not read on this reading.",
  });
  const up = (await withTimeout(uptime(14).catch(() => null), 4_000)) ?? null;
  boxes.push({
    id: "status",
    claim: "/api/status is 200 and has a public history.",
    state: up && up.samples > 0 ? (up.last?.ok ? "done" : "partly") : "partly",
    detail: up && up.samples
      ? `${up.samples} samples in fourteen days, ${(100 * (up.ratio ?? 0)).toFixed(1)}% with every beat green; last sample ${up.last?.ok ? "green" : "red"}.`
      : "The endpoint answers, but no sampled history has been recorded yet: the external pinger is not running.",
    link: "/api/status",
  });
  const listed = await listing;
  boxes.push({
    id: "seller",
    claim: "A Studio seller can list by ERC-8004 id without a ticket.",
    state: listed ? "done" : "partly",
    detail: listed
      ? `/list and POST /api/v1/list place any token on the six-rung ladder with its next step. Checked on this reading with Range-1: rung ${listed.placement.rung}, ${listed.placement.name}, read at block ${listed.blockNumber ?? "unknown"}.`
      : "/list is built, but its check did not answer inside its deadline on this reading.",
    link: "/list",
  });

  // Every public answer carries the block it was read at.
  const blocked = rerun?.block ?? null;
  boxes.push({
    id: "api-blocks",
    claim: "Every public API answer names the block it was read at.",
    state: blocked && listed?.blockNumber ? "done" : "partly",
    detail:
      "/api/v1/diagnose, /api/v1/list and /api/v1/agents stamp each answer with the chain, the block and the time. " +
      (blocked ? `On this reading the head was block ${blocked}.` : "The head block was not read on this reading."),
    link: "/api/v1/diagnose/0x54c06cC2623aAA2Dcc38B17fA07aD2e99b363C90",
  });

  // Every job has a stranger to hire and a live agent of ours beside it.
  const refs = (await referencing) ?? null;
  const perJob = CATEGORIES.map((c) => {
    const strangers = hireable.filter((l) => l.category === c && !isOurs(l)).length;
    const ref = refs?.[c] ?? null;
    return { c, strangers, ref, ok: strangers > 0 && ref?.status === "live" };
  });
  boxes.push({
    id: "every-job",
    claim: "Every job has at least one stranger to hire and one live reference agent of ours.",
    state: perJob.every((j) => j.ok) ? "done" : perJob.some((j) => j.ok) ? "partly" : "open",
    detail: perJob
      .map((j) => `${CATEGORY_LABEL[j.c]}: ${j.strangers} stranger${j.strangers === 1 ? "" : "s"} hireable, ${j.ref ? `${j.ref.name} ${j.ref.status}` : "reference unread"}`)
      .join("; "),
    link: "/categories",
  });
  boxes.push({
    id: "limits",
    claim: "The README prints the honest limits that still apply.",
    state: "partly",
    detail: "Kept by hand and checked on each deploy. Anything red on this page that the README does not mention is a bug in the README.",
  });

  return boxes;
}

/** One number for a badge: how much of the definition is true. */
export function score(boxes: Box[]): { done: number; partly: number; open: number; total: number } {
  return {
    done: boxes.filter((b) => b.state === "done").length,
    partly: boxes.filter((b) => b.state === "partly").length,
    open: boxes.filter((b) => b.state === "open").length,
    total: boxes.length,
  };
}
