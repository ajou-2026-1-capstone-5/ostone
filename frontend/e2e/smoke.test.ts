import { test, expect } from '@playwright/test';

test('should load the page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/frontend/);
  await expect(page.locator('text=Hello World')).toBeVisible();
});
