import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.OUTPUT_EXPORT === "true" ? "export" : undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
