import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Preserve the repository's existing agent instructions.
  agentRules: false,
};

export default nextConfig;
