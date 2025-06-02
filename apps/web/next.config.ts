import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   devIndicators: false,
   eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://accounts.google.com'
  ],
  /* config options here */
};

export default nextConfig;
