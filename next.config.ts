import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  turbopack: {
    root: process.cwd(),
  },
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
};

export default nextConfig;
