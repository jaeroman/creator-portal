import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// `.mts` rather than `.ts`: the package is CommonJS, so a `.ts` config using
// ESM syntax loads through a deprecated fallback.
export default defineConfig({
  test: {
    // Only `.test.ts`: Playwright owns `e2e/*.spec.ts`, and picking those up
    // here would run browser specs in a Node environment.
    include: ["**/*.test.ts"],
    environment: "node",
    // An empty suite must fail, so "no tests ran" never reads as "passed".
    passWithNoTests: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
