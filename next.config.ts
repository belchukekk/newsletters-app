import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root to this project — /var/www has an unrelated
    // stray package-lock.json that Turbopack would otherwise pick up as the
    // root instead.
    root: path.join(__dirname),
  },
};

export default nextConfig;
