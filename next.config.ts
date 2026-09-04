import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // The home directory above this project is itself a git repo with its own
  // lockfile; without this, Next infers the wrong workspace root.
  outputFileTracingRoot: __dirname,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "api.8004scan.io" }],
  },
  /**
   * Left as runtime requires rather than bundled.
   *
   * `@bnbagent/sdk` loads `@altananetwork/sdk` through a dynamic require — it
   * is an optional peer dependency, GPL-3.0, so the SDK does not hard-depend
   * on it. Webpack cannot follow that, so the bundled server reported the
   * package "not installed" while it sat in node_modules, and revocation
   * failed in production while working perfectly from the CLI. The Greenfield
   * SDK has the same shape.
   */
  serverExternalPackages: [
    "@bnbagent/sdk",
    "@altananetwork/sdk",
    "@bnb-chain/greenfield-js-sdk",
  ],
};

export default config;
