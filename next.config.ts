import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    quiet: true,
  } as any,
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
};

export default nextConfig;
