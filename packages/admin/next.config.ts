import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@lightning-tiger/shared"],
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client"],
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
