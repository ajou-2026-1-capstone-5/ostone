import { expect, test } from "@playwright/test";

import { makeJwt } from "./support/generated-api-auth";

test.describe("Login screen", () => {
  test.describe("Given a valid operator account", () => {
    test.describe("When the operator submits the login form", () => {
      test("Then the app stores the auth session and enters the workspace", async ({ page }) => {
        const seen: string[] = [];

        await page.route("**/api/v1/**", async (route) => {
          const request = route.request();
          const url = new URL(request.url());
          const path = url.pathname.replace(/^\/api\/v1/, "");
          const method = request.method();
          seen.push(`${method} ${path}`);

          if (method === "POST" && path === "/auth/login") {
            expect(request.postDataJSON()).toEqual({
              email: "agent@example.com",
              password: "password123",
            });
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                data: {
                  accessToken: makeJwt(),
                  refreshToken: "refresh-token",
                  tokenType: "Bearer",
                  expiresIn: 3600,
                  user: {
                    id: 7,
                    email: "agent@example.com",
                    name: "상담사",
                    role: "OPERATOR",
                  },
                },
              }),
            });
            return;
          }

          if (method === "GET" && path === "/workspaces") {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify([
                {
                  id: 1,
                  workspaceKey: "qa-workspace",
                  name: "QA Workspace",
                  status: "ACTIVE",
                  myRole: "OWNER",
                },
              ]),
            });
            return;
          }

          if (method === "GET" && path === "/workspaces/1") {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                id: 1,
                workspaceKey: "qa-workspace",
                name: "QA Workspace",
                status: "ACTIVE",
                myRole: "OWNER",
              }),
            });
            return;
          }

          if (method === "GET" && path === "/workspaces/1/domain-packs") {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({ data: [] }),
            });
            return;
          }

          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ code: "E2E_UNMOCKED", message: `${method} ${path}` }),
          });
        });

        await page.goto("/login");
        await page.getByLabel("이메일 주소").fill("agent@example.com");
        await page.getByLabel("비밀번호").fill("password123");
        await page.getByRole("button", { name: "시스템 로그인" }).click();

        await expect(page).toHaveURL(/\/workspaces\/1\/workflows/);
        await expect(page.getByText("워크플로우")).toBeVisible();
        await expect
          .poll(() => page.evaluate(() => window.localStorage.getItem("accessToken")))
          .toBeTruthy();
        expect(seen).toContain("POST /auth/login");
      });
    });
  });
});
