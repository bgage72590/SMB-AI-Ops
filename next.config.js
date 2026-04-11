/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep native + large server-only deps out of the webpack bundle; Next
    // will resolve them at runtime instead. `better-sqlite3` has a .node
    // binary so it MUST be external.
    serverComponentsExternalPackages: ["@anthropic-ai/sdk", "better-sqlite3"],
  },
};

module.exports = nextConfig;
