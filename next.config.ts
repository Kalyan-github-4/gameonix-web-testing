import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Team logos are capped at 2 MB; leave room for multipart overhead.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
