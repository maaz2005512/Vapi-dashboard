// next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // 🚨 Skip ESLint errors during production builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // 🚨 Skip TypeScript errors during production builds
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
