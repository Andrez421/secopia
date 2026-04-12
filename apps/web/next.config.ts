import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Opt into React 19 features
  reactStrictMode: true,

  // Transpile workspace packages
  transpilePackages: ["@secopia/socrata-client", "@secopia/types"],

  // Security headers
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
    {
      source: "/api/(.*)",
      headers: [
        { key: "Cache-Control", value: "no-store" },
      ],
    },
  ],
};

export default nextConfig;
