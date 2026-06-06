import { expect, test, type Page, type Route } from "@playwright/test";

import { installAuth, makeJwt } from "./support/generated-api-auth";
import { captureScreen, installAppApiMocks } from "./support/app-mocks";

type AccountScope = "previous" | "current";
type E2eRole = "OPERATOR" | "ADMIN" | "SUPER_ADMIN";

const previousWorkspace = {
  id: 1,
  workspaceKey: "previous-workspace",
  name: "Previous Account Workspace",
  description: "이전 계정 workspace",
  status: "ACTIVE",
  myRole: "OWNER",
  createdAt: "2026-06-01T00:00:00+09:00",
  updatedAt: "2026-06-04T09:00:00+09:00",
};

const currentWorkspace = {
  id: 2,
  workspaceKey: "current-workspace",
  name: "Current Account Workspace",
  description: "현재 계정 workspace",
  status: "ACTIVE",
  myRole: "OWNER",
  createdAt: "2026-06-02T00:00:00+09:00",
  updatedAt: "2026-06-04T09:00:00+09:00",
};

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

interface CrossAccountWorkspaceMockOptions {
  delayCurrentWorkspaceLoading?: boolean;
  initialAccount?: AccountScope;
}

interface CrossAccountWorkspaceMocks {
  seen: string[];
  releaseCurrentWorkspaceLoading: () => void;
}

function createDeferred(): Deferred {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installCrossAccountWorkspaceMocks(
  page: Page,
  options: CrossAccountWorkspaceMockOptions = {},
): Promise<CrossAccountWorkspaceMocks> {
  let account: AccountScope = options.initialAccount ?? "previous";
  const seen: string[] = [];
  let currentWorkspaceListCount = 0;
  const currentWorkspaceListLoading = options.delayCurrentWorkspaceLoading
    ? createDeferred()
    : null;
  const currentWorkspaceDetailLoading = options.delayCurrentWorkspaceLoading
    ? createDeferred()
    : null;

  const releaseCurrentWorkspaceLoading = () => {
    currentWorkspaceListLoading?.resolve();
    currentWorkspaceDetailLoading?.resolve();
  };

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    seen.push(`${account} ${method} ${path}${url.search}`);

    if (method === "POST" && path === "/auth/login") {
      expect(request.postDataJSON()).toEqual({
        email: "current@example.com",
        password: "password123",
      });
      account = "current";
      await fulfillJson(route, {
        data: {
          accessToken: makeJwt(),
          refreshToken: "current-refresh-token",
          tokenType: "Bearer",
          expiresIn: 3600,
          user: {
            id: 22,
            email: "current@example.com",
            name: "현재 상담사",
            role: "OPERATOR",
          },
        },
      });
      return;
    }

    if (method === "GET" && path === "/workspaces") {
      if (account === "current") {
        currentWorkspaceListCount += 1;
        if (currentWorkspaceListCount > 1) {
          await currentWorkspaceListLoading?.promise;
        }
      }
      await fulfillJson(
        route,
        account === "previous" ? [previousWorkspace] : [currentWorkspace],
      );
      return;
    }

    if (method === "GET" && path === "/workspaces/1") {
      if (account === "previous") {
        await fulfillJson(route, previousWorkspace);
        return;
      }
      await fulfillJson(
        route,
        { code: "WORKSPACE_ACCESS_DENIED", message: "접근 권한이 없습니다." },
        403,
      );
      return;
    }

    if (method === "GET" && path === "/workspaces/2") {
      await currentWorkspaceDetailLoading?.promise;
      await fulfillJson(route, currentWorkspace);
      return;
    }

    if (method === "GET" && path === "/workspaces/2/domain-packs") {
      await fulfillJson(route, { data: [], status: 200 });
      return;
    }

    if (method === "GET" && path === "/workspaces/1/consultation/metrics") {
      await fulfillJson(route, {
        workspaceId: 1,
        periodStart: "2026-05-29T00:00:00+09:00",
        periodEnd: "2026-06-04T09:00:00+09:00",
        totalConsultationCount: 7,
        completedConsultationCount: 6,
        averageFirstResponseSeconds: 42,
        averageLlmFirstResponseSeconds: 3,
        averageHumanFirstResponseSeconds: 120,
        llmHandledCount: 5,
        humanInterventionCount: 1,
        unresolvedSessionCount: 0,
        comparison: null,
        coverage: {
          workflowMatchedCount: 6,
          workflowMatchRate: 0.85,
          intentClassificationSuccessCount: 6,
          intentClassificationSuccessRate: 0.85,
          lowConfidenceCount: 0,
          lowConfidenceRate: 0,
          unmatchedSessionCount: 1,
          autoCompletedWorkflowCount: 5,
          humanHandoffRate: 0.14,
          llmOnlyProcessingRate: 0.71,
          measurementStatus: "READY",
          measurementMessage: "측정 가능",
          trend: [],
        },
        handledTodayCount: 2,
        llmHandledTodayCount: 2,
        humanHandledTodayCount: 0,
      });
      return;
    }

    if (method === "GET" && path === "/workspaces/1/dashboard/workflow-rankings") {
      await fulfillJson(route, {
        workspaceId: 1,
        periodStart: "2026-05-29T00:00:00+09:00",
        periodEnd: "2026-06-04T09:00:00+09:00",
        totalConsultationCount: 7,
        rankings: [],
        topRankings: [],
      });
      return;
    }

    if (method === "GET" && path === "/workspaces/1/dashboard/knowledge-pack-health") {
      await fulfillJson(route, {
        activeKnowledgePack: {
          packId: 1,
          packName: "Previous Account Pack",
          versionId: 1,
          versionNo: 1,
          publishedAt: "2026-06-01T00:00:00+09:00",
          createdAt: "2026-06-01T00:00:00+09:00",
          sourcePipelineJobId: null,
        },
        lastLogUpload: null,
        lastKnowledgePackGeneration: null,
        pendingReviewCount: 0,
      });
      return;
    }

    if (method === "GET" && path === "/workspaces/1/dashboard/action-recommendations") {
      await fulfillJson(route, {
        workspaceId: 1,
        periodStart: "2026-05-29T00:00:00+09:00",
        periodEnd: "2026-06-04T09:00:00+09:00",
        recommendations: [],
      });
      return;
    }

    await fulfillJson(route, { code: "E2E_UNMOCKED", message: `${method} ${path}` }, 500);
  });

  return { seen, releaseCurrentWorkspaceLoading };
}

async function replaceAuthSession(page: Page, role: E2eRole): Promise<void> {
  const token = makeJwt(role);
  const user = {
    id: role === "SUPER_ADMIN" ? 1 : 7,
    email: role === "SUPER_ADMIN" ? "admin@example.com" : "agent@example.com",
    name: role === "SUPER_ADMIN" ? "관리자" : "상담사",
    role,
  };

  await page.evaluate(
    ({ accessToken, user }) => {
      window.localStorage.setItem("accessToken", accessToken);
      window.localStorage.setItem("refreshToken", "e2e-refresh-token");
      window.localStorage.setItem("user", JSON.stringify(user));
      window.dispatchEvent(new Event("ostone:auth-session-changed"));
    },
    { accessToken: token, user },
  );
}

async function expectWorkspaceDashboard(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/workspaces\/1\/dashboard$/);
  await expect(page.getByRole("heading", { name: "대시보드", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "404" })).toHaveCount(0);
}

async function expectAdminConsoleHidden(page: Page): Promise<void> {
  await expect(page.getByText("CStone Admin Console")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "고객사 현황" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "결제 관리" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Airflow 운영" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "관리자 계정" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "SUPER_ADMIN 생성" })).toHaveCount(0);
  await expect(page.getByText("멤버 요약")).toHaveCount(0);
  await expect(page.getByText("draft generation timeout")).toHaveCount(0);
}

function hasAdminApiRequest(seen: string[]): boolean {
  return seen.some((entry) => /^GET \/admin|^POST \/admin|^PATCH \/admin|^DELETE \/admin/.test(entry));
}

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

    test("When a stale refresh token is rejected, Then stored auth state is cleared @critical", async ({
      page,
    }) => {
      const seen: string[] = [];
      const expiredAccessToken = makeJwt("OPERATOR", Math.floor(Date.now() / 1000) - 60);
      await page.addInitScript((expiredAccessToken) => {
        window.localStorage.setItem("accessToken", expiredAccessToken);
        window.localStorage.setItem("refreshToken", "expired-refresh-token");
        window.localStorage.setItem(
          "user",
          JSON.stringify({
            id: 71,
            email: "expired@example.com",
            name: "만료 사용자",
            role: "OPERATOR",
          }),
        );
      }, expiredAccessToken);
      await page.route("**/api/v1/**", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname.replace(/^\/api\/v1/, "");
        const method = request.method();
        seen.push(`${method} ${path}`);

        if (method !== "POST" || path !== "/auth/refresh") {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ code: "E2E_UNEXPECTED_API", message: `${method} ${path}` }),
          });
          return;
        }

        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ code: "TOKEN_EXPIRED", message: "expired" }),
        });
      });

      await page.goto("/workspaces/1/dashboard");

      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByLabel("이메일 주소")).toBeVisible();
      await expect(page.getByRole("button", { name: "시스템 로그인" })).toBeVisible();
      await expect(page.getByText("만료 사용자")).toHaveCount(0);
      await expect(page.getByTestId("workspace-marker")).toHaveCount(0);
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

  test.describe("Given the browser reaches another account's workspace URL", () => {
    test("When an operator opens an unauthorized workspace URL directly, Then no workspace data is exposed", async ({
      page,
    }) => {
      const { seen } = await installCrossAccountWorkspaceMocks(page, {
        initialAccount: "current",
      });
      await installAuth(page, {
        name: "현재 상담사",
        email: "current@example.com",
      });

      await page.goto("/workspaces/2/workflows");
      await expect(page.getByTestId("workspace-marker")).toContainText(
        "Current Account Workspace",
      );
      await expect(page.getByRole("heading", { name: "워크플로우" })).toBeVisible();

      await page.goto("/workspaces/1/dashboard");

      await expect(page).toHaveURL(/\/workspaces\/1\/dashboard$/);
      await expect(page.getByText("접근 권한이 없습니다.")).toBeVisible();
      await expect(page.getByTestId("workspace-marker")).not.toContainText(
        "Previous Account Workspace",
      );
      await expect(page.getByText("Previous Account Workspace")).toHaveCount(0);
      await expect(page.getByText("Previous Account Pack")).toHaveCount(0);
      await expect(page.getByText("총 상담")).toHaveCount(0);
      expect(seen).toContain("current GET /workspaces/1");
      expect(
        seen.some((entry) => entry.startsWith("current GET /workspaces/1/consultation/metrics")),
      ).toBe(false);
      expect(seen).not.toContain("current GET /workspaces/1/dashboard/knowledge-pack-health");

      await page.reload();
      await expect(page).toHaveURL(/\/workspaces\/1\/dashboard$/);
      await expect(page.getByText("접근 권한이 없습니다.")).toBeVisible();
      await expect(page.getByTestId("workspace-marker")).not.toContainText(
        "Previous Account Workspace",
      );
      await expect(page.getByText("Previous Account Workspace")).toHaveCount(0);
      await expect(page.getByText("Previous Account Pack")).toHaveCount(0);

      await page.getByTestId("workspace-marker").click();
      await expect(page.getByTestId("workspace-option-2")).toContainText(
        "Current Account Workspace",
      );
      await page.getByTestId("workspace-option-2").click();
      await expect(page).toHaveURL(/\/workspaces\/2\/workflows$/);
      await expect(page.getByTestId("workspace-marker")).toContainText(
        "Current Account Workspace",
      );
    });

    test("When a different account logs in and navigates back, Then previous workspace data is not exposed", async ({
      page,
    }) => {
      const { seen } = await installCrossAccountWorkspaceMocks(page);
      await installAuth(page, {
        name: "이전 상담사",
        email: "previous@example.com",
      });

      await page.goto("/workspaces/1/dashboard");
      await expect(page.getByTestId("workspace-marker")).toContainText(
        "Previous Account Workspace",
      );
      await expect(page.getByText("Previous Account Pack")).toBeVisible();

      await page.getByTestId("account-menu-trigger").click();
      await page.getByTestId("account-menu-logout").click();
      await expect(page).toHaveURL(/\/login$/);

      await page.getByLabel("이메일 주소").fill("current@example.com");
      await page.getByLabel("비밀번호").fill("password123");
      await page.getByRole("button", { name: "시스템 로그인" }).click();

      await expect(page).toHaveURL(/\/workspaces\/2\/workflows$/);
      await expect(page.getByTestId("workspace-marker")).toContainText("Current Account Workspace");

      await page.goBack();
      await expect(page).toHaveURL(/\/workspaces\/1\/dashboard$/);
      await expect(page.getByText("접근 권한이 없습니다.")).toBeVisible();
      await expect(page.getByText("Previous Account Workspace")).toHaveCount(0);
      await expect(page.getByText("Previous Account Pack")).toHaveCount(0);
      await expect(page.getByText("총 상담")).toHaveCount(0);
      expect(seen).toContain("current GET /workspaces/1");

      await page.goForward();
      await expect(page).toHaveURL(/\/workspaces\/2\/workflows$/);
      await expect(page.getByTestId("workspace-marker")).toContainText("Current Account Workspace");

      await page.goBack();
      await expect(page.getByText("접근 권한이 없습니다.")).toBeVisible();
      await page.reload();
      await expect(page).toHaveURL(/\/workspaces\/1\/dashboard$/);
      await expect(page.getByText("접근 권한이 없습니다.")).toBeVisible();
      await expect(page.getByText("Previous Account Workspace")).toHaveCount(0);
      await expect(page.getByText("Previous Account Pack")).toHaveCount(0);
    });

    test("When current workspace loading is slow, Then stale workspace data stays hidden", async ({
      page,
    }) => {
      const { seen, releaseCurrentWorkspaceLoading } =
        await installCrossAccountWorkspaceMocks(page, {
          delayCurrentWorkspaceLoading: true,
        });
      await installAuth(page, {
        name: "이전 상담사",
        email: "previous@example.com",
      });

      await page.goto("/workspaces/1/dashboard");
      await expect(page.getByTestId("workspace-marker")).toContainText(
        "Previous Account Workspace",
      );
      await expect(page.getByText("Previous Account Pack")).toBeVisible();

      await page.getByTestId("account-menu-trigger").click();
      await page.getByTestId("account-menu-logout").click();
      await expect(page).toHaveURL(/\/login$/);

      await page.getByLabel("이메일 주소").fill("current@example.com");
      await page.getByLabel("비밀번호").fill("password123");
      await page.getByRole("button", { name: "시스템 로그인" }).click();

      try {
        await expect(page).toHaveURL(/\/workspaces\/2\/workflows$/);
        await expect(
          page.getByText("워크스페이스 정보를 불러오는 중입니다."),
        ).toBeVisible();
        await expect(page.getByTestId("workspace-marker")).toContainText(
          "워크스페이스 선택",
        );
        await expect(page.getByText("Previous Account Workspace")).toHaveCount(0);
        await expect(page.getByText("Previous Account Pack")).toHaveCount(0);
        await expect(page.getByText("총 상담")).toHaveCount(0);
        expect(seen).toContain("current GET /workspaces/2");
        expect(
          seen.filter((entry) => entry === "current GET /workspaces").length,
        ).toBeGreaterThan(1);
      } finally {
        releaseCurrentWorkspaceLoading();
      }

      await expect(page.getByTestId("workspace-marker")).toContainText(
        "Current Account Workspace",
      );
      await expect(
        page.getByRole("heading", { name: "워크플로우", level: 1 }),
      ).toBeVisible();
      await expect(page.getByText("Previous Account Workspace")).toHaveCount(0);
      await expect(page.getByText("Previous Account Pack")).toHaveCount(0);
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

    test.describe("When they enter admin URLs without SUPER_ADMIN role", { tag: "@critical" }, () => {
      test("Then they return to workspace home without seeing admin data", async ({ page }) => {
        for (const adminPath of ["/admin", "/admin/super-admins"] as const) {
          await page.goto(adminPath);

          await expectWorkspaceDashboard(page);
          await expectAdminConsoleHidden(page);
        }

        expect(hasAdminApiRequest(seen)).toBe(false);
      });
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

  test.describe("Given a SUPER_ADMIN session", { tag: "@critical" }, () => {
    test("When admin URLs are opened and the role changes, Then the console follows the active role", async ({
      page,
    }) => {
      const seen: string[] = [];
      await installAppApiMocks(page, seen);
      await page.goto("/login");
      await replaceAuthSession(page, "SUPER_ADMIN");

      await page.goto("/admin");

      await expect(page).toHaveURL(/\/admin\/super-admins$/);
      await expect(page.getByRole("heading", { name: "관리자 계정" })).toBeVisible();
      await expect(page.getByRole("button", { name: "SUPER_ADMIN 생성" })).toBeVisible();

      await page.goto("/admin/super-admins");
      await expect(page).toHaveURL(/\/admin\/super-admins$/);
      await expect(page.getByRole("heading", { name: "관리자 계정" })).toBeVisible();
      await expect(page.getByRole("button", { name: "SUPER_ADMIN 생성" })).toBeVisible();

      await replaceAuthSession(page, "OPERATOR");
      await page.goto("/admin/super-admins?role=operator");

      await expectWorkspaceDashboard(page);
      await expectAdminConsoleHidden(page);
      expect(hasAdminApiRequest(seen)).toBe(false);
    });
  });
});
