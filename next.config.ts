import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // The home directory above this project is itself a git repo with its own
  // lockfile; without this, Next infers the wrong workspace root.
  outputFileTracingRoot: __dirname,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "api.8004scan.io" }],
  },
};

export default config;
