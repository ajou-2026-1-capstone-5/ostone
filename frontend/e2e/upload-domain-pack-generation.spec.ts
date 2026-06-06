import { expect, test, type Page } from "@playwright/test";

import { installAuth } from "./support/generated-api-auth";
import {
  installAppApiMocks,
  type AppApiMockOptions,
} from "./support/app-mocks";
import { installMockStomp } from "./support/mock-stomp";

const generationRequest =
  "POST /workspaces/1/datasets/77/pipeline-jobs/domain-pack-generation";

test.describe("Upload completed Domain Pack draft generation", () => {
  let seen: string[];

  test.beforeEach(() => {
    seen = [];
  });

  async function installUploadGenerationMocks(
    page: Page,
    options: AppApiMockOptions = {},
  ) {
    await installAuth(page);
    await installMockStomp(page);
    await installAppApiMocks(page, seen, {
      uploadLatestPipelineJob: "none",
      ...options,
    });
  }

  async function completeUpload(page: Page) {
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

    return page.getByRole("button", {
      name: "도메인팩 초안 생성 시작",
    });
  }

  test.describe("Given a completed consultation log upload without an automatic pipeline job", () => {
    test("When the operator requests Domain Pack 초안 생성, Then request feedback and review navigation are shown", async ({
      page,
    }) => {
      await installUploadGenerationMocks(page);
      const generationButton = await completeUpload(page);
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

    test("When the first generation request fails, Then the upload remains recoverable and retry succeeds", async ({
      page,
    }) => {
      await installUploadGenerationMocks(page, {
        domainPackGenerationFailureAttempts: 1,
      });
      const generationButton = await completeUpload(page);

      await generationButton.click();

      await expect(page.getByText("생성 요청 실패")).toBeVisible();
      await expect(
        page.getByRole("main").getByText(
          "도메인팩 초안 생성 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        ),
      ).toBeVisible();
      await expect(
        page.getByText("생성 요청 완료", { exact: true }),
      ).not.toBeVisible();
      await expect(page.getByText("생성 요청 중")).not.toBeVisible();
      await expect(page.getByText("refund-log.zip")).toBeVisible();
      await expect(page.getByText("dataset 77")).toBeVisible();
      await expect
        .poll(() => seen.filter((entry) => entry === generationRequest).length)
        .toBe(1);

      const retryButton = page.getByRole("button", { name: "다시 생성 요청" });
      await expect(retryButton).toBeVisible();
      await retryButton.click();

      await expect(
        page.getByText("생성 요청 완료", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(/job 900 · WAITING_DOMAIN_CONFIRMATION/),
      ).toBeVisible();
      await expect
        .poll(() => seen.filter((entry) => entry === generationRequest).length)
        .toBe(2);

      await page.getByRole("button", { name: "검토 화면으로 이동" }).click();

      await expect(page).toHaveURL(
        /\/workspaces\/1\/pipeline-jobs\/900\/review/,
      );
      await expect(page.getByText("상담 도메인을 확정합니다.")).toBeVisible();
      expect(
        seen.filter(
          (entry) => entry === "POST /workspaces/1/datasets/uploads:init",
        ),
      ).toHaveLength(1);
      expect(
        seen.filter(
          (entry) =>
            entry === "POST /workspaces/1/datasets/uploads/77:complete",
        ),
      ).toHaveLength(1);
    });
  });
});
