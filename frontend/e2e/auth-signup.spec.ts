import { expect, test } from "@playwright/test";

test.describe("Signup screen", () => {
  test.describe("Given a new operator", () => {
    test.describe("When the operator submits the signup form", () => {
      test("Then the account is requested and the user returns to login", async ({ page }) => {
        const seen: string[] = [];

        await page.route("**/api/v1/**", async (route) => {
          const request = route.request();
          const url = new URL(request.url());
          const path = url.pathname.replace(/^\/api\/v1/, "");
          const method = request.method();
          seen.push(`${method} ${path}`);

          if (method === "POST" && path === "/auth/signup") {
            expect(request.postDataJSON()).toEqual({
              name: "김상담",
              email: "new-agent@example.com",
              password: "password123",
            });
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                data: { id: 8, email: "new-agent@example.com", name: "김상담" },
              }),
            });
            return;
          }

          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ code: "E2E_UNMOCKED", message: `${method} ${path}` }),
          });
        });

        await page.goto("/signup");
        await page.getByLabel("이름").fill("김상담");
        await page.getByLabel("이메일 주소").fill("new-agent@example.com");
        await page.getByLabel("비밀번호 (8자 이상)").fill("password123");
        await page.getByLabel("비밀번호 확인").fill("password123");
        await page.getByRole("button", { name: "계정 생성 요청" }).click();

        await expect(page).toHaveURL(/\/login/);
        await expect(page.getByText("가입이 완료되었습니다")).toBeVisible();
        expect(seen).toContain("POST /auth/signup");
      });
    });
  });
});
