import type { NextConfig } from "next";

const { DEV_APP_ALLOWED_ORIGINS } = require('./dev-app.config.cjs');

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: DEV_APP_ALLOWED_ORIGINS,
  env: {
    NEXT_PUBLIC_DEV_APP_HOSTS: DEV_APP_ALLOWED_ORIGINS.join(','),
  },
  turbopack: {
    root: '/Users/sunghoon/Desktop/AHA/web/aha-v5',
  },
  // MathLive와 ComputeEngine은 브라우저 전용 — 서버 번들에서 제외
  serverExternalPackages: ['mathlive', '@cortex-js/compute-engine'],
};

export default nextConfig;
