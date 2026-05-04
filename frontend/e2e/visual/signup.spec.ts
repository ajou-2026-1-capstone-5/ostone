import { test, expect } from "@playwright/test";

test.describe("Signup", () => {
  test("1280x800 desktop layout", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/signup");
    await page.waitForTimeout(800);
    await expect(page).toHaveScreenshot("signup-desktop.png", {
      fullPage: false,
    });
  });
});
