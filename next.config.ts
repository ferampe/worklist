import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/.well-known/acme-challenge/:token",
        destination: "/api/acme/:token",
      },
    ];
  },
};

export default nextConfig;
