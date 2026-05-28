import { expect, test } from "@playwright/test";

import { installAuth } from "./support/generated-api-auth";
import { installConsultationApiMocks } from "./support/generated-api-mocks";

test.describe("Consultation screen", () => {
  let seen: string[];

  test.beforeEach(async ({ page }) => {
    seen = [];
    await installAuth(page);
    await installConsultationApiMocks(page, seen);
  });

  test.describe("Given an active consultation session from the generated queue endpoint", () => {
    test.describe("When an operator opens the session and completes it", () => {
      test("Then the screen loads generated messages and sends the status update", async ({
        page,
      }) => {
        await page.goto("/workspaces/1/consultation");
        await expect(page.getByText("김민지")).toBeVisible();

        await page.getByText("김민지").click();

        await expect(page.getByText("generated 상담 메시지")).toBeVisible();
        await expect(page.getByText("상담 종료")).toBeEnabled();
        await page.getByText("상담 종료").click();
        await expect(page.getByText("상담이 종료되었습니다.")).toBeVisible();
        expect(seen).toContain("GET /workspaces/1/consultation/queue");
        expect(seen).toContain("GET /consultation/sessions/601/messages");
        expect(seen).toContain("PATCH /consultation/sessions/601/status");
      });
    });
  });
});
