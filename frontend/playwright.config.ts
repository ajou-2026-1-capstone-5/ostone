/// <reference types="node" />
import { defineConfig } from "@playwright/test";

import { sharedProjects, sharedReporter } from "./playwright.base.config";

// localhost preview 서버를 띄워 모든 API를 mock하는 기존 e2e 구성.
// 운영 백엔드를 실제로 호출하는 라이브 스모크(e2e/live)는 별도 config로 분리되어 있으므로
// 여기서는 testIgnore로 제외하여 mock 실행에 섞이지 않게 한다.
export default defineConfig({
  testDir: "./e2e",
  testIgnore: "live/**",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: sharedReporter,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: sharedProjects,
  webServer: {
    command: "pnpm build && pnpm preview --host 127.0.0.1 --port 3000",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
