import { expect, test } from "@playwright/test";

// 이미 로그인된 상태(storageState 주입)에서 워크스페이스 진입 화면이 정상 렌더되는지 확인한다.
// 운영 데이터 상태를 가정하지 않는다: 워크스페이스가 없으면 생성 화면이, 있으면 워크플로우 화면이 뜬다.
// 둘 중 하나에 도달하면 화면이 정상 동작하는 것으로 본다(read-only, 데이터 잔존 없음).
test.describe("워크스페이스 진입 스모크", () => {
  test("워크스페이스 진입 시 생성 화면 또는 워크플로우 화면이 렌더된다", async ({ page }) => {
    await page.goto("/workspaces");

    const createHeading = page.getByRole("heading", { name: "워크스페이스 생성" });
    const workflowUrl = page.waitForURL(/\/workspaces\/\d+\/workflows/);

    await Promise.race([
      createHeading.waitFor({ state: "visible" }),
      workflowUrl,
    ]);

    const reachedCreate = await createHeading.isVisible();
    const reachedWorkflow = /\/workspaces\/\d+\/workflows/.test(page.url());
    expect(reachedCreate || reachedWorkflow).toBe(true);
  });
});
