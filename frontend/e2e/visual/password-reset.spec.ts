import { test, expect } from "@playwright/test";

test.describe("Password Reset", () => {
  test("1280x800 desktop layout", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/password-reset");
    await page.waitForTimeout(800);
    await expect(page).toHaveScreenshot("password-reset-desktop.png", {
      fullPage: false,
    });
  });
});
