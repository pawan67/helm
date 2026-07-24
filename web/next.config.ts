import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for a small Docker image.
  output: "standalone",
  // Run the MQTT subscriber once when the server process boots.
  experimental: {
    // instrumentation.ts is stable in 15, kept explicit for clarity.
  },
  // These packages pull in Node built-ins (node:crypto, net, tls). Keep them
  // server-external so webpack requires them at runtime instead of bundling
  // (which fails on the `node:` scheme in drizzle's migrator).
  serverExternalPackages: ["mqtt", "postgres", "drizzle-orm"],
};

export default nextConfig;
