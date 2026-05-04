import { test, expect } from "@playwright/test";

test.describe("Not Found", () => {
  test("1280x800 desktop layout", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/__nonexistent__");
    await page.waitForTimeout(800);
    await expect(page).toHaveScreenshot("not-found-desktop.png", {
      fullPage: false,
    });
  });
});
