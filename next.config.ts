import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: '/Users/sunghoon/Desktop/AHA/web/aha-v5',
  },
  // MathLive와 ComputeEngine은 브라우저 전용 — 서버 번들에서 제외
  serverExternalPackages: ['mathlive', '@cortex-js/compute-engine'],
};

export default nextConfig;
