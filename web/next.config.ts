import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for a small Docker image.
  output: "standalone",
  // These packages pull in Node built-ins (node:crypto, net, tls). Keep them
  // server-external so they're required at runtime instead of bundled (which
  // fails on the `node:` scheme in drizzle's migrator / mqtt / postgres).
  serverExternalPackages: ["mqtt", "postgres", "drizzle-orm"],
};

export default nextConfig;
