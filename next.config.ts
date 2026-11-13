import type { NextConfig } from "next";

// Static export: SchemaFlow is a fully client-side app with no server features.
// See docs/development/ARCHITECTURE.md (ADR-002).
const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
};

export default nextConfig;
