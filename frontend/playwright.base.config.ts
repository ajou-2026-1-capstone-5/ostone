/// <reference types="node" />
import { devices } from "@playwright/test";
import type { PlaywrightTestConfig } from "@playwright/test";

// mock e2e와 라이브 스모크 e2e가 공유하는 공통 설정.
// defineConfig로 내보내지 않고 부분 객체로 두어 각 config가 필요한 값만 합친다.

export const sharedReporter: PlaywrightTestConfig["reporter"] = "html";

export const chromiumProject: NonNullable<PlaywrightTestConfig["projects"]>[number] = {
  name: "chromium",
  use: { ...devices["Desktop Chrome"] },
};

export const sharedProjects: NonNullable<PlaywrightTestConfig["projects"]> = [chromiumProject];
