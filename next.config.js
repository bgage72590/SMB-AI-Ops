/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle in .next/standalone for the VM deploy.
  output: "standalone",
  // Pin the workspace root to this repo so a stray lockfile higher up
  // the tree doesn't change what gets traced into the bundle.
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
  // Keep native + large server-only deps out of the bundle; Next will
  // resolve them at runtime instead. `better-sqlite3` has a .node binary
  // so it MUST be external.
  serverExternalPackages: ["@anthropic-ai/sdk", "better-sqlite3"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
