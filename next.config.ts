import type { NextConfig } from "next";

// CORS origin - set CORS_ORIGIN env var in production (e.g., "https://yourdomain.com")
// Falls back to "*" in development only
const corsOrigin = process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'development' ? '*' : '');

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    // Skip CORS headers if no origin configured in production
    if (!corsOrigin) {
      console.warn('⚠️  CORS_ORIGIN not set. API will use same-origin only.');
      return [];
    }

    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: corsOrigin },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" },
        ]
      }
    ]
  },
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
