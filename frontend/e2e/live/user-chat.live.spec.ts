import { expect, test } from "@playwright/test";

import { isPollutingAllowed } from "./env";

// 운영 데이터 잔존: 사용자 데모 채팅을 시작하면 생성되는 채팅 세션·메시지는 정리 API가 없어 운영에 잔존한다(e2e- prefix로 식별).
// 데이터 오염을 막기 위해 기본 실행에서 제외하고, E2E_ALLOW_POLLUTING=true일 때만 활성화한다.
test.skip(
  !isPollutingAllowed(),
  "데이터 정리 API가 없어 기본 실행에서 제외됩니다. E2E_ALLOW_POLLUTING=true로 명시적으로 활성화하세요.",
);

// 사용자 채팅은 운영 실데이터/실시간 메시지(STOMP) 의존이 커서 메시지 흐름 단언은 신뢰하기 어렵다.
// 따라서 채팅 진입 화면 렌더와 legacy URL 정규화 라우팅 수준의 견고한 스모크만 수행한다.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("[@pollutes] 사용자 채팅 스모크", () => {
  test("legacy 워크스페이스 채팅 URL은 정규 채팅 URL로 리다이렉트된다", async ({ page }) => {
    await page.goto("/demo/workspaces/42/chat?name=%EA%B9%80%EB%AF%BC%EC%A7%80");

    await expect(page).toHaveURL(/\/demo\/chat\/42\?name=/);
    await expect(page.locator("body")).toBeVisible();
  });
});
