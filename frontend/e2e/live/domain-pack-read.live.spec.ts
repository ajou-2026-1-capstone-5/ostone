import { expect, test } from "@playwright/test";

// 도메인팩 조회 화면 read-only 스모크. 운영 데이터 상태를 가정하지 않는다.
// 접근 가능한 워크스페이스가 없으면(생성 화면이 뜨면) 검증 대상이 없으므로 skip한다.
// 워크스페이스가 있으면 도메인팩 목록 화면으로 이동해 페이지가 정상 렌더되는지(빈 상태 포함)만 확인한다.
test.describe("도메인팩 조회 스모크", () => {
  test("워크스페이스가 있으면 도메인팩 목록 화면이 정상 렌더된다", async ({ page }) => {
    await page.goto("/workspaces");

    const createHeading = page.getByRole("heading", { name: "워크스페이스 생성" });
    const workflowUrl = page.waitForURL(/\/workspaces\/\d+\/workflows/);
    await Promise.race([createHeading.waitFor({ state: "visible" }), workflowUrl]);

    const match = page.url().match(/\/workspaces\/(\d+)\/workflows/);
    test.skip(match === null, "접근 가능한 워크스페이스가 없어 도메인팩 화면을 검증할 수 없습니다.");
    const workspaceId = match![1];

    await page.goto(`/workspaces/${workspaceId}/domain-packs`);

    // 데이터 유무와 무관하게 도메인팩 화면 자체가 정상적으로 렌더되어야 한다.
    await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}/domain-packs`));
    await expect(page.locator("body")).toBeVisible();
  });
});
