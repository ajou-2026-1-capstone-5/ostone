import { expect, test, type Locator, type Page } from "@playwright/test";

import { installAuth } from "./support/generated-api-auth";
import { installAppApiMocks } from "./support/app-mocks";
import { installMockStomp } from "./support/mock-stomp";

const zipFile = {
  name: "refund-log.zip",
  mimeType: "application/zip",
  buffer: Buffer.from("PK\u0003\u0004-free-plan-limit"),
};

async function expectUploadBlockedGuidance(page: Page) {
  await expect(page.getByText("무료 온보딩 사용 완료")).toBeVisible();
  await expect(
    page.getByText(
      "무료 온보딩 권리가 사용 완료되었습니다. 활성 구독이 없으면 새 업로드와 생성 요청이 제한됩니다.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "처리 시작" })).toBeDisabled();
  await expect(page.locator('input[type="file"]')).toBeDisabled();
}

function expectNoUploadRequests(seen: string[]) {
  expect(seen).not.toContain("POST /workspaces/1/datasets/uploads:init");
  expect(seen).not.toContain("PUT /e2e-upload/raw-log.zip");
  expect(seen).not.toContain("POST /workspaces/1/datasets/uploads/77:complete");
}

async function dropZipFile(dropTarget: Locator) {
  const dataTransfer = await dropTarget.page().evaluateHandle(
    (payload) => {
      const transfer = new DataTransfer();
      const bytes = new Uint8Array(payload.bytes);
      transfer.items.add(
        new File([bytes], payload.name, { type: payload.mimeType }),
      );
      return transfer;
    },
    {
      bytes: Array.from(zipFile.buffer),
      mimeType: zipFile.mimeType,
      name: zipFile.name,
    },
  );

  await dropTarget.dispatchEvent("drop", { dataTransfer });
  await dataTransfer.dispose();
}

test.describe("Upload entitlement limits", () => {
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

  test.describe(
    "Given free onboarding is consumed without an active subscription",
    { tag: "@critical" },
    () => {
      test("When the operator tries file picker and drag/drop upload, Then both paths stay blocked", async ({
        page,
      }) => {
        await page.goto("/workspaces/1/upload");
        await expect(
          page.getByRole("heading", { name: "상담 로그 업로드" }),
        ).toBeVisible();
        await expectUploadBlockedGuidance(page);

        const fileInput = page.locator('input[type="file"]');
        const dropTarget = fileInput.locator("xpath=..");

        await fileInput.setInputFiles(zipFile);
        await expectUploadBlockedGuidance(page);
        expectNoUploadRequests(seen);

        await dropZipFile(dropTarget);
        await expectUploadBlockedGuidance(page);
        await expect(page.getByText(zipFile.name)).not.toBeVisible();
        expectNoUploadRequests(seen);
      });
    },
  );
});
