import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   devIndicators: false,
   eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  /* config options here */
};

export default nextConfig;
