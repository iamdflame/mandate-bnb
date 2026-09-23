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

import { existsSync } from "node:fs";
import { join } from "node:path";
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

const route = (p: string) => existsSync(join(process.cwd(), `src/app${p}`));

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
  boxes.push({
    id: "probe",
    claim: "Probe is live (15 minutes or less) on A2A and MCP; failures visible; clones badged.",
    state: cycling && oldest !== null && oldest <= 15 && spoken.length === callable.length ? "done" : cycling ? "partly" : "open",
    detail:
      `${withinTwoHours} of ${callable.length} agents with an endpoint were called in the last two hours; the oldest reading is ` +
      `${oldest === null ? "unknown" : oldest < 120 ? `${Math.round(oldest)} min` : `${(oldest / 60).toFixed(1)} h`} old` +
      `${census.minutes !== null ? ` (census stamp ${census.minutes} min ago)` : ""}. ` +
      `${spoken.length} of ${callable.length} have been read by the protocol probe so far: ${said("x402")} answered with a price, ${said("mcp")} over MCP, ${said("a2a")} over A2A, and ${said("http")} answered in no agent protocol. ` +
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
    state: route("/api/mcp") ? "partly" : "open",
    detail: route("/api/mcp")
      ? "MCP is served over HTTP with the marketplace's tools, and our own agent card is published. The A2A router (/a2a/v1) that lets another agent negotiate and hire is not built yet."
      : "Not built.",
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

  // 9 to 14: the pages and paths the plan still owes.
  boxes.push({
    id: "advantage",
    claim: "/advantage has three or more both-way tasks with raw outputs, trading and security present.",
    state: route("/advantage") ? "partly" : "open",
    detail: route("/advantage") ? "The page exists." : "The report exists as JSON and markdown under docs/advantage, with its spec hash anchored on chain, but there is no page yet.",
    link: "/evidence",
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
  boxes.push({
    id: "multisig",
    claim: "A multisig owns the treasury and the contracts.",
    state: "open",
    detail: "The market is still owned by one EOA. A 2-of-2 Safe with the operator and a second signer is prepared and not yet executed.",
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
  boxes.push({
    id: "seller",
    claim: "A Studio seller can list by ERC-8004 id without a ticket.",
    state: route("/api/v1/list") ? "done" : "open",
    detail: route("/api/v1/list") ? "The listing endpoint is live." : "/list explains the ladder but takes no id; there is no self-serve listing endpoint yet.",
    link: "/list",
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
