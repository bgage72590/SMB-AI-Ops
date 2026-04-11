import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    // Each test file runs in its own module context so the store's
    // cached connection doesn't leak across suites. This matches vitest's
    // default but we pin it explicitly because our tests rely on it.
    isolate: true,
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
