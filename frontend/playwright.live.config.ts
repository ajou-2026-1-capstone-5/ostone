/// <reference types="node" />
import { defineConfig } from "@playwright/test";

import { STORAGE_STATE_PATH } from "./e2e/live/global-setup";
import { sharedProjects, sharedReporter } from "./playwright.base.config";

// 운영 배포본을 브라우저로 열어 실제 백엔드를 호출하는 라이브 스모크 구성.
// mock 없이 운영 데이터를 다루므로 단일 워커/직렬 실행으로 오실행과 경합을 차단한다.
// 대상 URL/자격증명/운영 확인은 globalSetup이 검증하며, 토큰은 storageState로 주입된다.
// storageState 경로는 globalSetup이 기록하는 경로와 동일하게 재사용한다.

// config 파싱 시점(예: --list)에는 가드가 돌지 않아야 하므로 baseURL을 lazy하게 읽는다.
// 미설정이면 빈 문자열로 두고, 실제 실행 전 globalSetup이 E2E_BASE_URL/운영 확인을 강제한다.
const baseURL = process.env.E2E_BASE_URL?.trim() ?? "";

export default defineConfig({
  testDir: "./e2e/live",
  // 라이브 spec만 대상으로 한다. 헬퍼/setup/teardown(.ts)은 매처에서 제외된다.
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: sharedReporter,
  globalSetup: "./e2e/live/global-setup.ts",
  globalTeardown: "./e2e/live/global-teardown.ts",
  use: {
    // globalSetup이 E2E_BASE_URL 존재/운영 확인을 검증한 뒤의 값을 사용한다.
    baseURL,
    storageState: STORAGE_STATE_PATH,
    trace: "retain-on-failure",
  },
  projects: sharedProjects,
});
