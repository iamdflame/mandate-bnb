import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/**
 * Tests for the logic that decides things.
 *
 * The contracts have 83 tests and the application had none, which is the wrong
 * way round for a product whose off-chain half decides what an agent is allowed
 * to do and what its reputation really is. These cover the pure functions:
 * given these inputs, this decision — no network, no chain, no clock.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
});
