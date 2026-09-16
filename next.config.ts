import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Team logos live on Vercel Blob in production, and `next/image` refuses
    // any remote host that is not listed here. The subdomain is the store id,
    // which differs per environment, so it is matched as a wildcard.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/team-logos/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      // Team logos are capped at 2 MB; leave room for multipart overhead.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
