import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /** Team crests from API-Football CDN — cache optimized images permanently. */
    minimumCacheTTL: 31_536_000,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.api-sports.io",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "media.api-football.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
