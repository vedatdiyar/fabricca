import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components (Next.js 16) — enables `use cache` + PPR stable
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents
  cacheComponents: true,
  serverExternalPackages: ["@firecrawl/pdf-inspector"],
  turbopack: {
    root: process.cwd(),
  },
  logging: false,
  // optimizePackageImports: lucide-react zaten Next.js tarafından default optimize ediliyor
  // (https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports)
  // experimental ve production için önerilmediğinden ek override eklenmedi.
  experimental: {
    serverActions: {
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
