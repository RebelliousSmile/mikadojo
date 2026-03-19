import { defineConfig } from "@playwright/test";
import path from "path";

const fixturesDir = path.join(__dirname, "e2e", "fixtures");

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:5174",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: `node mcp-server/dist/index.js`,
    port: 5174,
    reuseExistingServer: false,
    env: {
      PORT: "5174",
      MIKADO_DIR: fixturesDir,
    },
  },
});
