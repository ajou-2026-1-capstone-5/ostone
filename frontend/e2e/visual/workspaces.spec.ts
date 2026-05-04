import { test, expect } from "@playwright/test";
import { authenticate } from "../helpers/auth";

test.describe("Workspace List", () => {
  test("1280x800 desktop layout", async ({ page }) => {
    await authenticate(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/workspaces");
    await page.waitForTimeout(800);
    await expect(page).toHaveScreenshot("workspace-list-desktop.png", {
      fullPage: false,
    });
  });

  test("375x667 mobile smoke", async ({ page }) => {
    await authenticate(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/workspaces");
    await page.waitForTimeout(800);
    await expect(page).toHaveScreenshot("workspace-list-mobile.png", {
      fullPage: false,
    });
  });
});
