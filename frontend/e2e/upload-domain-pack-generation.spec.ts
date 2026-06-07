import { expect, test, type Page, type Route } from "@playwright/test";

import { installAuth } from "./support/generated-api-auth";
import {
  installAppApiMocks,
  type AppApiMockOptions,
} from "./support/app-mocks";
import { installMockStomp } from "./support/mock-stomp";

const uploadInitRequest = "POST /workspaces/1/datasets/uploads:init";
const uploadCompleteRequest = "POST /workspaces/1/datasets/uploads/77:complete";
const generationRequest =
  "POST /workspaces/1/datasets/77/pipeline-jobs/domain-pack-generation";
const workspaceRequest = "GET /workspaces/1";
const subscriptionRequest = "GET /workspaces/1/subscription";

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installUploadCooldownMocks(
  page: Page,
  seen: string[],
  periodEnd: string,
) {
  let cooldownExpired = false;

  await page.route("**/api/v1/workspaces/1", async (route) => {
    seen.push(workspaceRequest);
    await fulfillJson(route, {
      id: 1,
      workspaceKey: "qa-workspace",
      name: "QA Workspace",
      description: "E2E workspace",
      status: "ACTIVE",
      myRole: "OWNER",
      freeOnboardingStatus: "CONSUMED",
      createdAt: "2026-05-01T00:00:00+09:00",
      updatedAt: "2026-06-04T09:00:00+09:00",
    });
  });

  await page.route("**/api/v1/workspaces/1/subscription", async (route) => {
    seen.push(subscriptionRequest);
    await fulfillJson(route, {
      data: {
        id: 11,
        workspaceId: 1,
        planKey: "PRO",
        status: cooldownExpired ? "ACTIVE" : "INCOMPLETE",
        currentPeriodStart: "2026-06-01T00:00:00+09:00",
        currentPeriodEnd: cooldownExpired
          ? "2026-07-01T00:00:00+09:00"
          : periodEnd,
        cancelAtPeriodEnd: false,
        customerKey: "customer-qa-workspace",
        memberLimit: 20,
        datasetUploadLimit: 100,
        pipelineRunLimit: 50,
      },
      status: 200,
    });
  });

  return {
    expireCooldown: () => {
      cooldownExpired = true;
    },
  };
}

test.describe("Free plan upload quota block", () => {
  let seen: string[];

  test.beforeEach(async ({ page }) => {
    seen = [];
    await installAuth(page);
    await installMockStomp(page);
    await installAppApiMocks(page, seen, {
      workspaceOneFreeOnboardingStatus: "CONSUMED",
      workspaceOneSubscriptionStatus: null,
    });
  });

  test.describe("Given a free workspace has exhausted its upload allowance", () => {
    test("When the operator opens upload, Then upload is blocked and billing for the same workspace is available", async ({
      page,
    }) => {
      await page.goto("/workspaces/1/upload");

      await expect(
        page.getByRole("heading", { name: "상담 로그 업로드" }),
      ).toBeVisible();
      await expect(page.getByTestId("workspace-marker")).toContainText(
        "QA Workspace",
      );
      await expect(page.getByText("무료 온보딩 사용 완료")).toBeVisible();
      await expect(
        page.getByText("무료 온보딩 권리가 사용 완료되었습니다."),
      ).toBeVisible();
      await expect(page.locator('input[type="file"]')).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "처리 시작" }),
      ).toBeDisabled();
      await expect(page.getByText("업로드 완료")).toBeHidden();

      expect(seen).not.toContain(uploadInitRequest);
      expect(seen).not.toContain(uploadCompleteRequest);
      expect(seen).not.toContain(generationRequest);

      await page
        .getByRole("button", { name: "구독/결제 화면으로 이동" })
        .click();

      await expect(page).toHaveURL(/\/workspaces\/1\/billing/);
      await expect(page.getByTestId("workspace-marker")).toContainText(
        "QA Workspace",
      );
      await expect(
        page.getByRole("heading", { name: "구독", level: 1 }),
      ).toBeVisible();
      await expect(page.getByRole("region", { name: "Free 요금제" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Pro 요금제" })).toBeVisible();

      expect(seen).toContain("GET /workspaces/1/billing/overview");
      expect(seen).not.toContain("GET /workspaces/2/billing/overview");
      expect(seen).not.toContain(uploadInitRequest);
      expect(seen).not.toContain(uploadCompleteRequest);
      expect(seen).not.toContain(generationRequest);
    });
  });
});

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
    await expect(page.getByText("자동 파이프라인 대기 중")).toBeVisible();

    return page.getByRole("button", {
      name: "도메인팩 초안 생성 시작",
    });
  }

  test.describe("Given a completed consultation log upload without an automatic pipeline job", () => {
    test("When an open pipeline review exists, Then upload exposes review navigation", async ({
      page,
    }) => {
      await installUploadGenerationMocks(page, {
        dashboardKnowledgePackHealth: "open-review",
      });

      await page.goto("/workspaces/1/upload");

      await expect(
        page.getByRole("heading", { name: "상담 로그 처리 기록" }),
      ).toBeVisible();
      await expect(
        page.getByText("검토가 필요한 최신 상담 로그 처리 기록입니다."),
      ).toBeVisible();
      await expect(page.getByRole("cell", { name: /refund-log\.zip/ })).toBeVisible();
      await expect(page.getByRole("cell", { name: "JOB-900" })).toBeVisible();
      await expect(
        page.getByRole("cell", { name: "WAITING_DOMAIN_CONFIRMATION" }),
      ).toBeVisible();

      await page.getByRole("button", { name: "검토 화면으로 이동" }).click();

      await expect(page).toHaveURL(
        /\/workspaces\/1\/pipeline-jobs\/900\/review/,
      );
      await expect(page.getByText("상담 도메인을 확정합니다.")).toBeVisible();
      expect(seen).toContain(
        "GET /workspaces/1/dashboard/knowledge-pack-health",
      );
      expect(seen).toContain(
        "GET /workspaces/1/pipeline-jobs/900/review-checkpoint",
      );
      expect(seen).not.toContain(uploadInitRequest);
      expect(seen).not.toContain(uploadCompleteRequest);
    });

    test(
      "When the operator uploads a valid ZIP, Then progress, completion, and the next Domain Pack action are visible",
      { tag: "@critical" },
      async ({ page }) => {
        await installUploadGenerationMocks(page, {
          uploadLatestPipelineJob: "none",
          uploadTransferDelayMs: 250,
        });

        await page.goto("/workspaces/1/upload");

        await expect(
          page.getByRole("heading", { name: "상담 로그 업로드" }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "처리 시작" }),
        ).toBeDisabled();
        await expect(page.getByText("업로드 완료")).toBeHidden();
        await expect(
          page.getByRole("button", { name: "도메인팩 초안 생성 시작" }),
        ).not.toBeVisible();

        await page.locator('input[type="file"]').setInputFiles({
          name: "refund-log.zip",
          mimeType: "application/zip",
          buffer: Buffer.from("PK\u0003\u0004-e2e"),
        });
        await expect(page.getByText("refund-log.zip")).toBeVisible();

        await page.getByRole("button", { name: "처리 시작" }).click();

        await expect(page.getByText("파일 업로드 중...")).toBeVisible();
        await expect(page.getByText("업로드 완료")).toBeHidden();
        await expect(
          page.getByRole("button", { name: "도메인팩 초안 생성 시작" }),
        ).not.toBeVisible();

        await expect(page.getByText("업로드 완료").first()).toBeVisible();
        await expect(page.getByText("refund-log.zip")).toBeVisible();
        await expect(page.getByText("dataset 77")).toBeVisible();
        await expect(page.getByText("자동 파이프라인 대기 중")).toBeVisible();
        await expect(
          page.getByRole("button", { name: "도메인팩 초안 생성 시작" }),
        ).toBeVisible();

        expect(seen).toContain(uploadInitRequest);
        expect(seen).toContain("PUT /e2e-upload/raw-log.zip");
        expect(seen).toContain(uploadCompleteRequest);
        expect(seen).toContain(
          "GET /workspaces/1/datasets/77/pipeline-jobs/latest?jobType=INGESTION",
        );
        expect(seen).not.toContain(generationRequest);
      },
    );

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

    test.describe(
      "When the requested generation job is still running",
      { tag: "@critical" },
      () => {
        test("Then the review screen shows progress and keeps approval actions unavailable", async ({
          page,
        }) => {
          await installUploadGenerationMocks(page, {
            generatedPipelineJob: "running",
          });
          const generationButton = await completeUpload(page);

          await generationButton.click();

          await expect(
            page.getByText("생성 요청 완료", { exact: true }),
          ).toBeVisible();
          await expect(page.getByText(/job 905 · RUNNING/)).toBeVisible();

          await page
            .getByRole("button", { name: "검토 화면으로 이동" })
            .click();

          await expect(page).toHaveURL(
            /\/workspaces\/1\/pipeline-jobs\/905\/review/,
          );
          const context = page.getByLabel("파이프라인 리뷰 맥락");
          await expect(context).toContainText("RUNNING");
          await expect(context).toContainText("활성 체크포인트 없음");
          await expect(context).toContainText(
            "완료 후 Domain Pack 화면에서 진행",
          );
          await expect(
            page.getByText("활성 리뷰 체크포인트가 없습니다."),
          ).toBeVisible();
          await expect(
            page.getByRole("button", { name: "상태 새로고침" }),
          ).toBeVisible();
          await expect(
            page.getByRole("link", { name: "도메인팩 관리로 이동" }),
          ).toHaveCount(0);
          await expect(
            page.getByRole("button", { name: /승인|적용|배포/ }),
          ).toHaveCount(0);
          expect(seen).toContain("POST /workspaces/1/datasets/uploads:init");
          expect(seen).toContain(
            "POST /workspaces/1/datasets/77/pipeline-jobs/domain-pack-generation",
          );
          expect(seen).toContain(
            "GET /workspaces/1/pipeline-jobs/905/review-checkpoint",
          );
          expect(seen).not.toContain(
            "GET /workspaces/1/pipeline-jobs/900/review-checkpoint",
          );
          expect(
            seen.some((entry) =>
              entry.startsWith("GET /workspaces/2/pipeline-jobs/905"),
            ),
          ).toBe(false);
        });
      },
    );
  });

  test.describe("Given a paid workspace upload cooldown has a known period boundary", () => {
    test("When the cooldown expires, Then the operator can upload a ZIP without refreshing the page", async ({
      page,
    }) => {
      await installUploadGenerationMocks(page);
      const now = new Date();
      await page.clock.install({ time: now });
      const cooldown = await installUploadCooldownMocks(
        page,
        seen,
        new Date(now.getTime() + 1_000).toISOString(),
      );

      await page.goto("/workspaces/1/upload");

      await expect(page.getByText("무료 온보딩 사용 완료")).toBeVisible();
      await expect(page.locator('input[type="file"]')).toBeDisabled();

      cooldown.expireCooldown();
      await page.clock.fastForward(1500);

      await expect(page.getByText(/활성 구독이 적용되어/)).toBeVisible();
      await expect(page.locator('input[type="file"]')).toBeEnabled();

      await page.locator('input[type="file"]').setInputFiles({
        name: "refund-log.zip",
        mimeType: "application/zip",
        buffer: Buffer.from("PK\u0003\u0004-e2e"),
      });
      await page.getByRole("button", { name: "처리 시작" }).click();

      await expect(page.getByText("업로드 완료").first()).toBeVisible();
      await expect(page.getByText("refund-log.zip")).toBeVisible();
      await expect(page.getByText("dataset 77")).toBeVisible();
      expect(
        seen.filter((entry) => entry === subscriptionRequest).length,
      ).toBeGreaterThanOrEqual(2);
      expect(seen).toContain("POST /workspaces/1/datasets/uploads:init");
      expect(seen).toContain("PUT /e2e-upload/raw-log.zip");
      expect(seen).toContain("POST /workspaces/1/datasets/uploads/77:complete");
    });
  });
});
