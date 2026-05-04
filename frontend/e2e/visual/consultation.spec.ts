import { test, expect } from "@playwright/test";
import { authenticate } from "../helpers/auth";

test.describe("Consultation", () => {
  test("1280x800 desktop layout", async ({ page }) => {
    await authenticate(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/consultation");
    await page.waitForTimeout(800);
    await expect(page).toHaveScreenshot("consultation-desktop.png", {
      fullPage: false,
    });
  });
});
