import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

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

export default withNextIntl(nextConfig);
