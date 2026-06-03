import { expect, test } from "@playwright/test";

import { isPollutingAllowed } from "./env";

// 운영 데이터 잔존: 가입한 계정은 삭제 API가 없어 운영 DB에 영구 잔존한다(e2e- prefix로 식별).
// 데이터 오염을 막기 위해 기본 실행에서 제외하고, E2E_ALLOW_POLLUTING=true일 때만 활성화한다.
test.skip(
  !isPollutingAllowed(),
  "데이터 정리 API가 없어 기본 실행에서 제외됩니다. E2E_ALLOW_POLLUTING=true로 명시적으로 활성화하세요.",
);

// 가입 spec은 로그인된 상태가 필요 없으므로 storageState를 비워 비로그인 상태에서 시작한다.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("[@pollutes] 운영 회원가입 스모크", () => {
  test("고유 이메일로 가입하면 로그인 화면으로 이동하고 완료 안내가 표시된다", async ({ page }) => {
    const unique = Date.now();
    const name = `e2e-${unique}`;
    const email = `e2e-${unique}@example.com`;
    const password = "Password123!";

    await page.goto("/signup");
    await page.getByLabel("이름").fill(name);
    await page.getByLabel("이메일 주소").fill(email);
    await page.getByLabel("비밀번호 (8자 이상)").fill(password);
    await page.getByLabel("비밀번호 확인").fill(password);
    await page.getByRole("button", { name: "계정 생성 요청" }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("가입이 완료되었습니다")).toBeVisible();
  });
});
