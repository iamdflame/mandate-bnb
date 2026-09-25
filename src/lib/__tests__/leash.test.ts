import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { USDT as SERVER_USDT } from "../chain/leash";
import { VUSDT as SERVER_VUSDT } from "../chain/house";
import { USDT, VUSDT } from "../../components/x/LeashWizard";
import { sessionKeyFor, sessionPublicFor } from "../leash/keys";
import { LEASH_POLICIES, permissionsFor } from "../leash/policy";

describe("a user leash", () => {
  it("uses the server's own USDT and Venus market addresses in the browser", () => {
    expect(USDT).toBe(SERVER_USDT);
    expect(VUSDT).toBe(SERVER_VUSDT);
  });

  it("derives one key per wallet and agent, the same every time, and a different one for any other", () => {
    process.env.LEASH_MASTER_KEY = `0x${"11".repeat(32)}`;
    const a = "0x00000000000000000000000000000000000000aa";
    const b = "0x00000000000000000000000000000000000000bb";
    expect(sessionKeyFor(a, "yield-1")).toBe(sessionKeyFor(a, "yield-1"));
    expect(sessionKeyFor(a, "yield-1")).not.toBe(sessionKeyFor(b, "yield-1"));
    expect(sessionKeyFor(a, "yield-1")).not.toBe(sessionKeyFor(a, "guard-1"));
    const pub = sessionPublicFor(a, "yield-1")!;
    expect(pub.address).toBe(privateKeyToAccount(sessionKeyFor(a, "yield-1")!).address);
  });

  it("grants only Venus calls that act for the caller, never an approve or a transfer, under a daily USDT cap", () => {
    for (const p of Object.values(LEASH_POLICIES)) {
      for (const c of p.calls) {
        expect(c.to).toBe(SERVER_VUSDT);
        expect(c.signature).not.toMatch(/approve|transfer|Behalf|setApproval/);
      }
    }
    const perms = permissionsFor("yield-1", 0.5);
    expect(perms.spend.find((s) => "token" in s && s.token === SERVER_USDT)?.limit).toBe(500_000_000_000_000_000n);
  });
});
