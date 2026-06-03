import { expect, test } from "@playwright/test";

import { isPollutingAllowed } from "./env";

// 운영 데이터 잔존: 상담 화면 조작으로 생성/변경되는 상담 세션·메시지는 정리 API가 없어 운영에 잔존한다(e2e- prefix로 식별).
// 데이터 오염을 막기 위해 기본 실행에서 제외하고, E2E_ALLOW_POLLUTING=true일 때만 활성화한다.
test.skip(
  !isPollutingAllowed(),
  "데이터 정리 API가 없어 기본 실행에서 제외됩니다. E2E_ALLOW_POLLUTING=true로 명시적으로 활성화하세요.",
);

// 운영 실데이터/실시간 메시지(STOMP) 의존이 커서 메시지 내용 단언은 신뢰하기 어렵다.
// 따라서 무리한 단언 대신 상담 화면 진입/렌더 수준의 견고한 스모크만 수행한다.
test.describe("[@pollutes] 상담 화면 스모크", () => {
  test("상담 화면에 진입하면 화면이 정상 렌더된다", async ({ page }) => {
    await page.goto("/workspaces");

    const createHeading = page.getByRole("heading", { name: "워크스페이스 생성" });
    const workflowUrl = page.waitForURL(/\/workspaces\/\d+\/workflows/);
    await Promise.race([createHeading.waitFor({ state: "visible" }), workflowUrl]);

    const match = page.url().match(/\/workspaces\/(\d+)\/workflows/);
    test.skip(match === null, "접근 가능한 워크스페이스가 없어 상담 화면을 검증할 수 없습니다.");
    const workspaceId = match![1];

    await page.goto(`/workspaces/${workspaceId}/consultation`);

    await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}/consultation`));
    await expect(page.locator("body")).toBeVisible();
  });
});
