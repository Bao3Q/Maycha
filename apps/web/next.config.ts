import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiProxyTarget =
      process.env.API_PROXY_TARGET ?? "http://localhost:3001";

    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
