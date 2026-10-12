import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@dantown/auth",
    "@dantown/database",
    "@dantown/shared",
    "@dantown/ui",
  ],
  experimental: {
    cpus: 2,
  },
};

export default nextConfig;
