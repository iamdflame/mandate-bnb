/**
 * Live market state.
 *
 * Server-sent events rather than polling from the browser: the floor needs a
 * steady tick, and the chain read is cheap on the server and expensive to fan
 * out to every viewer. One reader, many watchers.
 */

import {
  MANDATE_MARKET_ABI,
  MARKET_ADDRESS,
  marketClient,
  readLiveMandates,
} from "@/lib/chain/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TICK_MS = 2_000;

export interface FloorMandate {
  id: number;
  category: number;
  state: number;
  principal: string;
  agent: string;
  capitalWei: string;
  bondWei: string;
  /** Bond as a fraction of the winning bid, so slashing is visible. */
  bondFraction: number;
  cumulativeAlphaBps: number;
  epochsSettled: number;
  epochsTotal: number;
  strikes: number;
  successor: string | null;
}

export interface FloorSnapshot {
  at: string;
  chainId: number;
  market: string;
  blockNumber: string;
  mandates: FloorMandate[];
  totals: {
    underMandate: string;
    bonded: string;
    active: number;
    /** Every mandate ever opened, including those long since closed. */
    everOpened: number;
    dismissals: number;
    slashedWei: string;
  };
}

async function readSnapshot(): Promise<FloorSnapshot> {
  // Only live mandates. Closed ones are book history and reading them all
  // every tick is what stalled the stream once the market had run a while.
  const [blockNumber, { live: mandates, total }] = await Promise.all([
    marketClient.getBlockNumber(),
    readLiveMandates(),
  ]);

  const successors = await Promise.all(
    mandates.map((m) =>
      marketClient
        .readContract({
          address: MARKET_ADDRESS,
          abi: MANDATE_MARKET_ABI,
          functionName: "successor",
          args: [BigInt(m.id)],
        })
        .catch(() => null),
    ),
  );

  // The original bid backing each holder, so a slashed bond reads as a
  // fraction rather than an absolute nobody can calibrate against.
  const originals = await Promise.all(
    mandates.map(async (m) => {
      try {
        const bids = (await marketClient.readContract({
          address: MARKET_ADDRESS,
          abi: MANDATE_MARKET_ABI,
          functionName: "getBids",
          args: [BigInt(m.id)],
        })) as readonly { agent: string; bond: bigint }[];
        const held = bids.find((b) => b.agent.toLowerCase() === m.agent.toLowerCase());
        return held?.bond ?? m.bond;
      } catch {
        return m.bond;
      }
    }),
  );

  let underMandate = 0n;
  let bonded = 0n;
  let active = 0;

  const out: FloorMandate[] = mandates.map((m, i) => {
    underMandate += m.capital;
    bonded += m.bond;
    if (m.state === 1) active += 1;
    const original = originals[i] ?? m.bond;
    return {
      id: m.id,
      category: m.category,
      state: m.state,
      principal: m.principal,
      agent: m.agent,
      capitalWei: m.capital.toString(),
      bondWei: m.bond.toString(),
      bondFraction: original > 0n ? Number((m.bond * 1000n) / original) / 1000 : 0,
      cumulativeAlphaBps: Number(m.cumulativeAlphaBps),
      epochsSettled: m.epochsSettled,
      epochsTotal: m.epochsTotal,
      strikes: m.strikes,
      successor: (successors[i] as string | null) ?? null,
    };
  });

  return {
    at: new Date().toISOString(),
    chainId: marketClient.chain?.id ?? 0,
    market: MARKET_ADDRESS,
    blockNumber: blockNumber.toString(),
    mandates: out,
    totals: {
      underMandate: underMandate.toString(),
      bonded: bonded.toString(),
      active,
      everOpened: total,
      dismissals: 0,
      slashedWei: "0",
    },
  };
}

export async function GET(req: Request) {
  if (!MARKET_ADDRESS) {
    return new Response(
      JSON.stringify({ error: "MARKET_ADDRESS not configured" }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      const tick = async () => {
        if (closed) return;
        try {
          send("state", await readSnapshot());
        } catch (error) {
          send("stale", { message: String(error).slice(0, 160) });
        }
      };

      await tick();
      timer = setInterval(tick, TICK_MS);

      req.signal.addEventListener("abort", () => {
        closed = true;
        if (timer) clearInterval(timer);
        try {
          controller.close();
        } catch {
          /* already gone */
        }
      });
    },
    cancel() {
      if (timer) clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
