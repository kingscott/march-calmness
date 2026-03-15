import type { NextConfig } from "next";

// instrumentation.ts is loaded automatically in Next.js 15+; no flag needed.
const nextConfig: NextConfig = {};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
