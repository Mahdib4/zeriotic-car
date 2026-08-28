import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A production build and a running `next dev` both write to .next, and a
  // build run against a live dev server leaves it serving stale chunk ids
  // (404s and "__webpack_modules__[moduleId] is not a function"). `npm run
  // build:check` sets this so a verification build never disturbs dev.
  distDir: process.env.BUILD_DIST_DIR || ".next",
  // three + r3f ship untranspiled ESM in places; keep them on the server-compile path
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
  experimental: {
    optimizePackageImports: ["framer-motion"],
  },
};

export default nextConfig;
