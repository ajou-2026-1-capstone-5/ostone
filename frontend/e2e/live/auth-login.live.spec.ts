import { expect, test } from "@playwright/test";

import { loginViaUi } from "./support/auth";

// 운영 백엔드에 실제 로그인 요청을 보내 UI 로그인 흐름 자체를 검증한다(read-only, 데이터 잔존 없음).
// 다른 라이브 spec은 globalSetup이 저장한 storageState로 이미 로그인된 상태를 쓰지만,
// 이 spec은 로그인 동작을 직접 확인해야 하므로 storageState를 비워 비로그인 상태에서 시작한다.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("운영 로그인 스모크", () => {
  test("이메일/비밀번호로 로그인하면 워크플로우 화면에 진입하고 토큰이 저장된다", async ({ page }) => {
    await loginViaUi(page);

    await expect(page).toHaveURL(/\/workspaces\/\d+\/workflows/);
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem("accessToken")))
      .toBeTruthy();
  });
});
