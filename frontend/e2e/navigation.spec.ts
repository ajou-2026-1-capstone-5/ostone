import { expect, test } from "@playwright/test";

import { installAuth } from "./support/generated-api-auth";
import { captureScreen, installAdminApiMocks, installAppApiMocks } from "./support/app-mocks";

test.describe("Application navigation boundaries", () => {
  test.describe("Given no authenticated session", () => {
    test("When an anonymous visitor opens a private workspace URL, Then they are sent to login", async ({
      page,
    }) => {
      const seen: string[] = [];
      await page.route("**/api/v1/**", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        seen.push(`${request.method()} ${url.pathname.replace(/^\/api\/v1/, "")}`);
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ code: "E2E_UNEXPECTED_API", message: url.pathname }),
        });
      });

      await page.goto("/workspaces/1/dashboard");

      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("button", { name: "시스템 로그인" })).toBeVisible();
      expect(seen).toEqual(["POST /auth/refresh"]);
    });

    test("When a stale refresh token is rejected, Then stored auth state is cleared", async ({
      page,
    }) => {
      const seen: string[] = [];
      await page.addInitScript(() => {
        window.localStorage.setItem("refreshToken", "expired-refresh-token");
        window.localStorage.setItem("user", JSON.stringify({ name: "만료 사용자" }));
      });
      await page.route("**/api/v1/auth/refresh", async (route) => {
        seen.push("POST /auth/refresh");
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ code: "TOKEN_EXPIRED", message: "expired" }),
        });
      });

      await page.goto("/workspaces/1/dashboard");

      await expect(page).toHaveURL(/\/login$/);
      await expect
        .poll(() =>
          page.evaluate(() => ({
            accessToken: window.localStorage.getItem("accessToken"),
            refreshToken: window.localStorage.getItem("refreshToken"),
            user: window.localStorage.getItem("user"),
          })),
        )
        .toEqual({ accessToken: null, refreshToken: null, user: null });
      expect(seen).toEqual(["POST /auth/refresh"]);
    });
  });

  test.describe("Given an authenticated operator", () => {
    let seen: string[];

    test.beforeEach(async ({ page }) => {
      seen = [];
      await installAuth(page);
      await installAppApiMocks(page, seen);
    });

    test("When they enter workspace shortcut URLs, Then redirects land on the canonical screens", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(page).toHaveURL(/\/workspaces\/1\/dashboard$/);
      await expect(page.getByRole("heading", { name: "대시보드", exact: true })).toBeVisible();

      await page.goto("/workspaces/1");
      await expect(page).toHaveURL(/\/workspaces\/1\/dashboard$/);

      await page.goto("/workspaces/1/pipeline");
      await expect(page).toHaveURL(/\/workspaces\/1\/upload$/);
      await expect(page.getByRole("heading", { name: "상담 로그 업로드" })).toBeVisible();

      await page.goto("/upload");
      await expect(page).toHaveURL(/\/workspaces\/1\/dashboard$/);

      await page.goto("/consultation/601");
      await expect(page).toHaveURL(/\/workspaces\/1\/dashboard$/);
      expect(seen).toContain("GET /workspaces");
      expect(seen).toContain("GET /workspaces/1");
    });

    test("When they open an admin URL without SUPER_ADMIN role, Then they return to workspace home", async ({
      page,
    }) => {
      await page.goto("/admin/customers");

      await expect(page).toHaveURL(/\/workspaces\/1\/dashboard$/);
      await expect(page.getByRole("heading", { name: "대시보드", exact: true })).toBeVisible();
    });

    test("When they use the 404 page actions, Then previous and home navigation remain usable", async ({
      page,
    }, testInfo) => {
      await page.goto("/demo");
      await page.goto("/missing-route");

      await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
      await expect(page.getByText("요청하신 페이지를 찾을 수 없습니다.")).toBeVisible();
      await captureScreen(page, testInfo, "not-found-actions");

      await page.getByRole("button", { name: "이전 페이지" }).click();
      await expect(page).toHaveURL(/\/demo$/);

      await page.goto("/another-missing-route");
      await page.getByRole("button", { name: "홈으로 돌아가기" }).click();
      await expect(page).toHaveURL(/\/workspaces\/1\/dashboard$/);
      await expect(page.getByRole("heading", { name: "대시보드", exact: true })).toBeVisible();
    });
  });

  test.describe("Given a SUPER_ADMIN session", () => {
    test("When they open the admin root, Then the default console section is selected", async ({
      page,
    }) => {
      const seen: string[] = [];
      await installAuth(page, {
        role: "SUPER_ADMIN",
        name: "관리자",
        email: "admin@example.com",
      });
      await installAdminApiMocks(page, seen);

      await page.goto("/admin");

      await expect(page).toHaveURL(/\/admin\/super-admins$/);
      await expect(page.getByRole("heading", { name: "관리자 계정" })).toBeVisible();
      await expect(page.getByRole("button", { name: "SUPER_ADMIN 생성" })).toBeVisible();
      expect(seen).toEqual([]);
    });
  });
});
