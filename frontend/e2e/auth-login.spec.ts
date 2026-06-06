import { expect, test, type Page, type Route } from "@playwright/test";

import { makeJwt } from "./support/generated-api-auth";

const workspace = {
  id: 1,
  workspaceKey: "qa-workspace",
  name: "QA Workspace",
  status: "ACTIVE",
  myRole: "OWNER",
};

const activePackSummary = {
  packId: 1,
  workspaceId: 1,
  name: "Generated API Pack",
  description: "상담 로그에서 생성된 환불 자동화 팩",
  status: "ACTIVE",
  currentVersionId: 1,
  currentVersionNo: 1,
};

const activePackDetail = {
  ...activePackSummary,
  code: "PACK_REFUND",
  versions: [
    {
      versionId: 1,
      packId: 1,
      versionNo: 1,
      lifecycleStatus: "PUBLISHED",
      summaryJson: "{}",
      description: "운영 중인 환불 상담 자동화 버전",
      intentCount: 1,
      slotCount: 1,
      policyCount: 1,
      riskCount: 1,
      workflowCount: 1,
    },
  ],
};

const workflow = {
  id: 401,
  domainPackVersionId: 1,
  intentDefinitionId: 501,
  workflowCode: "WF_REFUND",
  name: "환불 처리",
  description: "주문번호를 확인하고 환불 정책에 따라 안내하는 workflow",
  initialState: "start",
  terminalStatesJson: '["done"]',
  graphJson: null,
  evidenceJson: "{}",
  metaJson: "{}",
};

type DomainPackMode = "empty" | "active";

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installLoginApiMocks(
  page: Page,
  seen: string[],
  domainPackMode: DomainPackMode,
) {
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
      await fulfillJson(route, {
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
      });
      return;
    }

    if (method === "GET" && path === "/workspaces") {
      await fulfillJson(route, [workspace]);
      return;
    }

    if (method === "GET" && path === "/workspaces/1") {
      await fulfillJson(route, workspace);
      return;
    }

    if (method === "GET" && path === "/workspaces/1/domain-packs") {
      const packs = domainPackMode === "active" ? [activePackSummary] : [];
      await fulfillJson(route, { data: packs });
      return;
    }

    if (
      domainPackMode === "active" &&
      method === "GET" &&
      path === "/workspaces/1/domain-packs/1"
    ) {
      await fulfillJson(route, { data: activePackDetail });
      return;
    }

    if (
      domainPackMode === "active" &&
      method === "GET" &&
      path === "/workspaces/1/domain-packs/1/versions/1/workflows"
    ) {
      await fulfillJson(route, { data: [workflow] });
      return;
    }

    seen.push(`UNMOCKED ${method} ${path}`);
    await fulfillJson(
      route,
      { code: "E2E_UNMOCKED", message: `${method} ${path}` },
      500,
    );
  });
}

test.describe("Login screen", () => {
  test.describe("Given a valid operator account", () => {
    test.describe("When the operator submits the login form", () => {
      test("Then the app stores the auth session and enters the workspace", async ({
        page,
      }) => {
        const seen: string[] = [];

        await installLoginApiMocks(page, seen, "empty");

        await page.goto("/login");
        await page.getByLabel("이메일 주소").fill("agent@example.com");
        await page.getByLabel("비밀번호").fill("password123");
        await page.getByRole("button", { name: "시스템 로그인" }).click();

        await expect(page).toHaveURL(/\/workspaces\/1\/workflows/);
        await expect(
          page.getByRole("heading", { name: "워크플로우", level: 1 }),
        ).toBeVisible();
        await expect
          .poll(() =>
            page.evaluate(() => window.localStorage.getItem("accessToken")),
          )
          .toBeTruthy();
        expect(seen).toContain("POST /auth/login");
        expect(seen.filter((entry) => entry.startsWith("UNMOCKED "))).toEqual(
          [],
        );
      });

      test("Then an operator with an active domain pack lands on current workspace operations", async ({
        page,
      }) => {
        const seen: string[] = [];

        await page.addInitScript(() => {
          window.localStorage.setItem("accessToken", "legacy-access-token");
          window.localStorage.setItem("refreshToken", "legacy-refresh-token");
          window.localStorage.setItem(
            "user",
            JSON.stringify({
              id: 999,
              email: "legacy@example.com",
              name: "이전 운영자",
              role: "OPERATOR",
            }),
          );
        });
        await installLoginApiMocks(page, seen, "active");

        await page.goto("/login");
        await page.getByLabel("이메일 주소").fill("agent@example.com");
        await page.getByLabel("비밀번호").fill("password123");
        await page.getByRole("button", { name: "시스템 로그인" }).click();

        await expect(page).toHaveURL(/\/workspaces\/1\/workflows$/);
        await expect(page.getByTestId("workspace-marker")).toContainText(
          "QA Workspace",
        );
        await expect(
          page.getByRole("heading", { name: "워크플로우", level: 1 }),
        ).toBeVisible();
        await expect(page.getByTestId("workspace-workflows")).toBeVisible();
        await expect(
          page.getByTestId("workspace-workflows-card-401"),
        ).toContainText("Generated API Pack");
        await expect(
          page.getByTestId("workspace-workflows-card-401"),
        ).toContainText("환불 처리");
        await expect(
          page.getByTestId("sidebar-link-dashboard"),
        ).toHaveAttribute("href", "/workspaces/1/dashboard");
        await expect(page.getByTestId("sidebar-domain-link")).toHaveAttribute(
          "href",
          "/workspaces/1/domain-packs",
        );
        await expect(
          page.getByTestId("workspace-workflows-card-401-open"),
        ).toBeEnabled();
        await expect(
          page.getByRole("heading", { name: "상담 로그 업로드" }),
        ).not.toBeVisible();
        await expect
          .poll(() =>
            page.evaluate(
              () =>
                JSON.parse(window.localStorage.getItem("user") ?? "{}").name,
            ),
          )
          .toBe("상담사");
        await expect(page.getByText("이전 운영자")).toHaveCount(0);
        await expect(page.getByText("Legacy Workspace")).toHaveCount(0);
        expect(page.url()).not.toContain("/workspaces/999");
        expect(seen).toContain("POST /auth/login");
        expect(seen).toContain("GET /workspaces");
        expect(seen).toContain("GET /workspaces/1/domain-packs");
        expect(seen).toContain("GET /workspaces/1/domain-packs/1");
        expect(seen).toContain(
          "GET /workspaces/1/domain-packs/1/versions/1/workflows",
        );
        expect(seen.filter((entry) => entry.startsWith("UNMOCKED "))).toEqual(
          [],
        );
      });

      test("Then a workspace without domain packs exposes log upload and keeps context after refresh", async ({
        page,
      }) => {
        const seen: string[] = [];
        const workspace = {
          id: 42,
          workspaceKey: "empty-cs-workspace",
          name: "신규 상담팀",
          status: "ACTIVE",
          myRole: "OWNER",
          freeOnboardingStatus: "AVAILABLE",
        };
        const legacyWorkspace = {
          id: 99,
          workspaceKey: "legacy-workspace",
          name: "이전 계정 워크스페이스",
          status: "ARCHIVED",
          myRole: "OWNER",
          freeOnboardingStatus: "UNAVAILABLE",
        };

        await page.addInitScript(() => {
          if (
            window.sessionStorage.getItem("e2e-legacy-auth-seeded") === "true"
          ) {
            return;
          }
          window.sessionStorage.setItem("e2e-legacy-auth-seeded", "true");
          window.localStorage.setItem("accessToken", "legacy-access-token");
          window.localStorage.setItem("refreshToken", "legacy-refresh-token");
          window.localStorage.setItem(
            "user",
            JSON.stringify({
              id: 99,
              email: "previous@example.com",
              name: "이전 계정",
              role: "OPERATOR",
            }),
          );
        });

        await page.route("**/api/v1/**", async (route) => {
          const request = route.request();
          const url = new URL(request.url());
          const path = url.pathname.replace(/^\/api\/v1/, "");
          const method = request.method();
          seen.push(`${method} ${path}`);

          if (method === "POST" && path === "/auth/login") {
            expect(request.postDataJSON()).toEqual({
              email: "operator@example.com",
              password: "password123",
            });
            await fulfillJson(route, {
              data: {
                accessToken: makeJwt(),
                refreshToken: "current-refresh-token",
                tokenType: "Bearer",
                expiresIn: 3600,
                user: {
                  id: 7,
                  email: "operator@example.com",
                  name: "신규 상담사",
                  role: "OPERATOR",
                },
              },
            });
            return;
          }

          if (method === "GET" && path === "/workspaces") {
            await fulfillJson(route, [workspace, legacyWorkspace]);
            return;
          }

          if (method === "GET" && path === "/workspaces/42") {
            await fulfillJson(route, workspace);
            return;
          }

          if (method === "GET" && path === "/workspaces/42/domain-packs") {
            await fulfillJson(route, { data: [] });
            return;
          }

          if (method === "GET" && path === "/workspaces/99/domain-packs") {
            await fulfillJson(route, {
              data: [
                {
                  packId: 990,
                  workspaceId: 99,
                  name: "Legacy Domain Pack",
                  currentVersionId: 9901,
                  currentVersionNo: 1,
                  status: "PUBLISHED",
                },
              ],
            });
            return;
          }

          if (method === "GET" && path === "/workspaces/42/subscription") {
            await fulfillJson(
              route,
              {
                code: "SUBSCRIPTION_NOT_FOUND",
                message: "subscription not found",
              },
              404,
            );
            return;
          }

          seen.push(`UNMOCKED ${method} ${path}`);
          await fulfillJson(
            route,
            {
              code: "E2E_UNMOCKED",
              message: `${method} ${path}`,
            },
            500,
          );
        });

        await page.goto("/login");
        await page.getByLabel("이메일 주소").fill("operator@example.com");
        await page.getByLabel("비밀번호").fill("password123");
        await page.getByRole("button", { name: "시스템 로그인" }).click();

        await expect(page).toHaveURL(/\/workspaces\/42\/workflows$/);
        await expect(page.getByTestId("workspace-marker")).toContainText(
          "신규 상담팀",
        );
        await expect(
          page.getByTestId("workspace-workflows-empty"),
        ).toBeVisible();
        await expect(page.getByText("이전 계정", { exact: true })).toBeHidden();
        await expect(
          page.getByText("이전 계정 워크스페이스", { exact: true }),
        ).toBeHidden();
        await expect(page.getByText("Legacy Domain Pack")).toBeHidden();

        await page.getByRole("button", { name: "상담 로그 업로드" }).click();

        await expect(page).toHaveURL(/\/workspaces\/42\/upload$/);
        await expect(page.getByTestId("workspace-marker")).toContainText(
          "신규 상담팀",
        );
        await expect(
          page.getByRole("heading", { name: "상담 로그 업로드" }),
        ).toBeVisible();
        await expect(
          page.getByText("파일을 클릭하거나 끌어다 놓으세요"),
        ).toBeVisible();

        await page.reload();

        await expect(page).toHaveURL(/\/workspaces\/42\/upload$/);
        await expect(page.getByTestId("workspace-marker")).toContainText(
          "신규 상담팀",
        );
        await expect(
          page.getByRole("heading", { name: "상담 로그 업로드" }),
        ).toBeVisible();
        await expect
          .poll(() =>
            page.evaluate(() => {
              const user = JSON.parse(
                window.localStorage.getItem("user") ?? "{}",
              ) as {
                name?: string;
              };
              return {
                accessToken: window.localStorage.getItem("accessToken"),
                refreshToken: window.localStorage.getItem("refreshToken"),
                userName: user.name,
              };
            }),
          )
          .toEqual({
            accessToken: expect.any(String),
            refreshToken: null,
            userName: "신규 상담사",
          });
        expect(seen).toContain("POST /auth/login");
        expect(seen).toContain("GET /workspaces/42/domain-packs");
        expect(seen).not.toContain("GET /workspaces/99/domain-packs");
        expect(seen.filter((entry) => entry.startsWith("UNMOCKED "))).toEqual(
          [],
        );
      });
    });
  });
});
