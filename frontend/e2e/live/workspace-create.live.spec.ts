import { expect, test } from "@playwright/test";

import { loginViaApi } from "./support/auth";
import {
  archiveWorkspace,
  registerWorkspace,
  removeFromRegistry,
} from "./support/cleanup-registry";

// 운영에 워크스페이스를 실제로 생성하는 스모크. 생성된 리소스는 archive API로 정리 가능하므로 기본 tier에 둔다.
// 이름에 타임스탬프를 붙여 고유 식별자(e2e- prefix)를 부여하고, afterEach에서 즉시 archive로 정리한다.
// 정리에 실패해도 throw하지 않는다: globalTeardown이 레지스트리 기반으로 잔존분을 재정리한다.
test.describe("워크스페이스 생성 스모크", () => {
  let createdId: number | null = null;
  let createdLabel = "";

  test.afterEach(async ({ request }) => {
    if (createdId === null) {
      return;
    }
    const id = createdId;
    try {
      const session = await loginViaApi(request);
      const archived = await archiveWorkspace(request, id, session.accessToken);
      if (archived) {
        removeFromRegistry(id);
      } else {
        console.warn(`[live-e2e] 워크스페이스 ${id} 정리 실패(archive 거부). globalTeardown이 재시도합니다.`);
      }
    } catch (error) {
      console.warn(
        `[live-e2e] 워크스페이스 ${id} 정리 중 오류. globalTeardown이 재시도합니다: ${String(error)}`,
      );
    } finally {
      createdId = null;
    }
  });

  test("이름을 입력해 워크스페이스를 생성하면 워크플로우 화면으로 이동한다", async ({ page }) => {
    createdLabel = `e2e-${Date.now()}`;

    await page.goto("/workspaces");
    await expect(page.getByRole("heading", { name: "워크스페이스 생성" })).toBeVisible();
    await page.getByLabel("이름").fill(createdLabel);
    await page.getByRole("button", { name: "생성" }).click();

    await page.waitForURL(/\/workspaces\/\d+\/workflows/);
    await expect(page.getByText("워크스페이스를 생성했습니다.")).toBeVisible();

    const match = page.url().match(/\/workspaces\/(\d+)\/workflows/);
    expect(match).not.toBeNull();
    createdId = Number(match![1]);
    registerWorkspace(createdId, createdLabel);
  });
});
