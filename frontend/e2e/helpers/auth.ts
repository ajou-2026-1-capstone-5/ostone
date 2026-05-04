import type { Page } from "@playwright/test";

const MOCK_JWT =
  "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJleHAiOjk5OTk5OTk5OTl9.";

export async function authenticate(page: Page): Promise<void> {
  await page.goto("/login");
  await page.evaluate((token) => {
    localStorage.setItem("accessToken", token);
    localStorage.setItem(
      "user",
      JSON.stringify({ id: 1, email: "test@example.com", name: "Test", role: "ADMIN" }),
    );
  }, MOCK_JWT);
}
