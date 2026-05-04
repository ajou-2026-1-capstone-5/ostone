import { test, expect } from "@playwright/test";

test.describe("Login", () => {
  test("1280x800 desktop layout", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login");
    await page.waitForTimeout(800);
    await expect(page).toHaveScreenshot("login-desktop.png", {
      fullPage: false,
    });
  });
});
