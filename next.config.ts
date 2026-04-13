import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    '@cloudflare/realtimekit-react',
    '@cloudflare/realtimekit-react-ui',
  ],
  reactStrictMode: true,
  // better-sqlite3 is a native module only for local dev — exclude from Workers build
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
