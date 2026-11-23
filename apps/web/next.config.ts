import type { NextConfig } from "next";

const API_ORIGIN = process.env.API_PROXY_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${API_ORIGIN}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
