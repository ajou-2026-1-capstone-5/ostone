import { expect, test } from "@playwright/test";

test.describe("Password reset screens", () => {
  test.describe("Given a user who forgot their password", () => {
    test.describe("When they request a password reset email", () => {
      test("Then the request is sent through the generated auth endpoint", async ({ page }) => {
        const seen: string[] = [];

        await page.route("**/api/v1/**", async (route) => {
          const request = route.request();
          const url = new URL(request.url());
          const path = url.pathname.replace(/^\/api\/v1/, "");
          const method = request.method();
          seen.push(`${method} ${path}`);

          if (method === "POST" && path === "/auth/password-reset/init") {
            expect(request.postDataJSON()).toEqual({ email: "agent@example.com" });
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({ data: { message: "재설정 메일을 발송했습니다." } }),
            });
            return;
          }

          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ code: "E2E_UNMOCKED", message: `${method} ${path}` }),
          });
        });

        await page.goto("/password-reset");
        await page.getByLabel("이메일").fill("agent@example.com");
        await page.getByRole("button", { name: "재설정 메일 받기" }).click();

        await expect(page.getByText("재설정 메일을 발송했습니다.")).toBeVisible();
        expect(seen).toContain("POST /auth/password-reset/init");
      });
    });
  });

  test.describe("Given a valid reset token", () => {
    test.describe("When the user submits mismatched passwords", () => {
      test("Then the form blocks completion before calling the API", async ({ page }) => {
        const seen: string[] = [];

        await page.route("**/api/v1/**", async (route) => {
          const request = route.request();
          const url = new URL(request.url());
          const path = url.pathname.replace(/^\/api\/v1/, "");
          seen.push(`${request.method()} ${path}`);
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ code: "E2E_UNEXPECTED_API", message: path }),
          });
        });

        await page.goto("/password-reset/complete?token=reset-token-e2e");
        await page.getByLabel("새 비밀번호", { exact: true }).fill("password123");
        await page.getByLabel("새 비밀번호 확인", { exact: true }).fill("password456");
        await page.getByRole("button", { name: "비밀번호 변경하기" }).click();

        await expect(page.getByText("비밀번호가 일치하지 않습니다.")).toBeVisible();
        expect(seen).toEqual([]);
      });
    });

    test.describe("When the user submits a new password", () => {
      test("Then the password is updated and the completion state is rendered", async ({
        page,
      }) => {
        const seen: string[] = [];

        await page.route("**/api/v1/**", async (route) => {
          const request = route.request();
          const url = new URL(request.url());
          const path = url.pathname.replace(/^\/api\/v1/, "");
          const method = request.method();
          seen.push(`${method} ${path}`);

          if (method === "POST" && path === "/auth/password-reset/complete") {
            expect(request.postDataJSON()).toEqual({
              resetToken: "reset-token-e2e",
              newPassword: "password123",
            });
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({ data: { message: "비밀번호가 변경되었습니다." } }),
            });
            return;
          }

          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ code: "E2E_UNMOCKED", message: `${method} ${path}` }),
          });
        });

        await page.goto("/password-reset/complete?token=reset-token-e2e");
        await page.getByLabel("새 비밀번호", { exact: true }).fill("password123");
        await page.getByLabel("새 비밀번호 확인", { exact: true }).fill("password123");
        await page.getByRole("button", { name: "비밀번호 변경하기" }).click();

        await expect(page.getByText("완료!")).toBeVisible();
        await expect(page.getByText("비밀번호가 성공적으로 변경되었습니다.")).toBeVisible();
        expect(seen).toContain("POST /auth/password-reset/complete");
      });
    });
  });
});
