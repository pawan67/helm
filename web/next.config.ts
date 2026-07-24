import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for a small Docker image.
  output: "standalone",
  // Run the MQTT subscriber once when the server process boots.
  experimental: {
    // instrumentation.ts is stable in 15, kept explicit for clarity.
  },
  // The `mqtt` package pulls in Node built-ins; keep it server-external so it
  // is not bundled/traced incorrectly by Turbopack/webpack.
  serverExternalPackages: ["mqtt", "postgres"],
};

export default nextConfig;
