import { expect, test } from "@playwright/test";

import { installAuth } from "./support/generated-api-auth";
import { installAppApiMocks } from "./support/app-mocks";
import { installMockStomp } from "./support/mock-stomp";

test.describe("Paid plan upload cooldown", () => {
  let seen: string[];

  test.beforeEach(async ({ page }) => {
    seen = [];
    await installAuth(page);
    await installMockStomp(page);
    await installAppApiMocks(page, seen, { paidUploadCooldown: true });
  });

  test("When a paid workspace is in cooldown, Then upload cannot start and no dataset or pipeline job is created", async ({
    page,
  }) => {
    await page.goto("/workspaces/1/upload");

    await expect(
      page.getByRole("heading", { name: "상담 로그 업로드" }),
    ).toBeVisible();
    await expect(page.getByText("도메인팩 작업 쿨다운 중")).toBeVisible();
    await expect(page.getByText(/재개 가능 시점/)).toBeVisible();
    await expect(page.locator('input[type="file"]')).toBeDisabled();
    await expect(page.getByRole("button", { name: "처리 시작" })).toBeDisabled();

    expect(seen).toContain("GET /workspaces/1/subscription");
    expect(seen).not.toContain("POST /workspaces/1/datasets/uploads:init");
    expect(seen).not.toContain("POST /workspaces/1/datasets/uploads/77:complete");
    expect(seen).not.toContain(
      "POST /workspaces/1/datasets/77/pipeline-jobs/domain-pack-generation",
    );
  });
});
