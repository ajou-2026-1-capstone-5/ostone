import { expect, test } from "@playwright/test";

import { isPollutingAllowed } from "./env";

// 운영 데이터 잔존: 데모 채팅을 시작하면 생성되는 데모 채팅 세션·메시지는 정리 API가 없어 운영에 잔존한다(e2e- prefix로 식별).
// 데이터 오염을 막기 위해 기본 실행에서 제외하고, E2E_ALLOW_POLLUTING=true일 때만 활성화한다.
test.skip(
  !isPollutingAllowed(),
  "데이터 정리 API가 없어 기본 실행에서 제외됩니다. E2E_ALLOW_POLLUTING=true로 명시적으로 활성화하세요.",
);

// 데모 화면은 공개 페이지이며 운영 실데이터(데모 회사 구성)에 의존한다.
// 데이터 유무를 가정하지 않고 데모 진입 화면이 정상 렌더되는지 수준의 견고한 스모크만 수행한다.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("[@pollutes] 데모 화면 스모크", () => {
  test("데모 회사 선택 화면에 진입하면 화면이 정상 렌더된다", async ({ page }) => {
    await page.goto("/demo");

    await expect(page).toHaveURL(/\/demo/);
    await expect(page.locator("body")).toBeVisible();
  });
});
