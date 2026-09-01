import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Next allows only one dev server per project directory, so a run has to reuse
// one that is already up. Its lock file is the only record of the port, which
// Next picks itself whenever the default is taken.
function runningDevServerPort(): string | undefined {
  try {
    const lock = JSON.parse(readFileSync(".next/dev/lock", "utf8")) as {
      port?: number;
    };
    return typeof lock.port === "number" ? String(lock.port) : undefined;
  } catch {
    return undefined;
  }
}

// Not the dev default: port 3000 is often serving an unrelated project, and
// reusing a server there would silently test the wrong app.
const PORT = process.env.PORT ?? runningDevServerPort() ?? "3100";
const BASE_URL = "http://localhost:" + PORT;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  // The dev server compiles each route on its first request, so the first
  // navigation of a run is far slower than the rest.
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --port " + PORT,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
