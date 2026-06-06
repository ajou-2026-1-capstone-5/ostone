import { expect, test } from "@playwright/test";

import { installAuth } from "./support/generated-api-auth";
import { installAppApiMocks } from "./support/app-mocks";
import { installMockStomp } from "./support/mock-stomp";

const generationRequest =
  "POST /workspaces/1/datasets/77/pipeline-jobs/domain-pack-generation";

test.describe("Upload completed Domain Pack draft generation", () => {
  let seen: string[];

  test.beforeEach(async ({ page }) => {
    seen = [];
    await installAuth(page);
    await installMockStomp(page);
    await installAppApiMocks(page, seen, { uploadLatestPipelineJob: "none" });
  });

  test.describe("Given a completed consultation log upload without an automatic pipeline job", () => {
    test("When the operator requests Domain Pack 초안 생성, Then request feedback and review navigation are shown", async ({
      page,
    }) => {
      await page.goto("/workspaces/1/upload");
      await expect(
        page.getByRole("heading", { name: "상담 로그 업로드" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "도메인팩 초안 생성 시작" }),
      ).not.toBeVisible();

      await page.locator('input[type="file"]').setInputFiles({
        name: "refund-log.zip",
        mimeType: "application/zip",
        buffer: Buffer.from("PK\u0003\u0004-e2e"),
      });
      await page.getByRole("button", { name: "처리 시작" }).click();

      await expect(page.getByText("업로드 완료").first()).toBeVisible();
      await expect(page.getByText("refund-log.zip")).toBeVisible();
      await expect(page.getByText("dataset 77")).toBeVisible();
      await expect(page.getByText("파이프라인 준비 중")).toBeVisible();

      const generationButton = page.getByRole("button", {
        name: "도메인팩 초안 생성 시작",
      });
      await expect(generationButton).toBeVisible();
      await generationButton.dblclick();

      await expect(
        page.getByText("생성 요청 완료", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(/job 900 · WAITING_DOMAIN_CONFIRMATION/),
      ).toBeVisible();
      await expect
        .poll(() => seen.filter((entry) => entry === generationRequest).length)
        .toBe(1);

      await page.getByRole("button", { name: "검토 화면으로 이동" }).click();

      await expect(page).toHaveURL(
        /\/workspaces\/1\/pipeline-jobs\/900\/review/,
      );
      await expect(page.getByText("상담 도메인을 확정합니다.")).toBeVisible();
      expect(seen).toContain("POST /workspaces/1/datasets/uploads:init");
      expect(seen).toContain("PUT /e2e-upload/raw-log.zip");
      expect(seen).toContain("POST /workspaces/1/datasets/uploads/77:complete");
      expect(seen).toContain(
        "GET /workspaces/1/datasets/77/pipeline-jobs/latest?jobType=INGESTION",
      );
    });
  });
});
