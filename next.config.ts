import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // The live pipeline reads the shared agent prompts from disk at runtime.
  outputFileTracingIncludes: {
    "/api/analyze": ["./prompts/**/*"],
  },
};

export default nextConfig;
