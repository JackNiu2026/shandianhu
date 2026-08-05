import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@lightning-tiger/shared"],
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client"],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
      {
        source: "/api/(.*)",
        headers: [
          { key: "X-RateLimit-Limit", value: "100" },
        ],
      },
    ];
  },
  webpack: (config) => {
    // 别名：将 @lightning-tiger/shared 指向 monorepo 源码
    config.resolve.alias = {
      ...config.resolve.alias,
      "@lightning-tiger/shared": path.resolve(
        __dirname,
        "../shared/index.ts",
      ),
    };
    return config;
  },
};

export default nextConfig;
