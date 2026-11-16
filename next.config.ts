import type { NextConfig } from "next";

// Static export: SchemaFlow is a fully client-side app with no server features.
// See docs/development/ARCHITECTURE.md (ADR-002).
const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  // QA hooks (P2-T10, ADR-020) are off unless the build runs with NEXT_PUBLIC_QA_HOOKS=1. Always
  // defining the value makes it a build-time constant ("0" or "1"), so a normal build never reads
  // it at run time and the minifier drops the hook code paths.
  env: { NEXT_PUBLIC_QA_HOOKS: process.env.NEXT_PUBLIC_QA_HOOKS === "1" ? "1" : "0" },
};

export default nextConfig;
