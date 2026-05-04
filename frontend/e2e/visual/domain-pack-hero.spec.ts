import { test, expect } from "@playwright/test";
import { authenticate } from "../helpers/auth";

test.describe("Domain Pack Hero", () => {
  test("1280x800 desktop layout", async ({ page }) => {
    await authenticate(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/workspaces/1/domain-packs/1/hero");
    await page.waitForTimeout(800);
    await expect(page).toHaveScreenshot("domain-pack-hero-desktop.png", {
      fullPage: false,
    });
  });
});
