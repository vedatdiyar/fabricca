import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@firecrawl/pdf-inspector"],
  cacheComponents: true,
  turbopack: {
    root: process.cwd(),
  },
  logging: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
