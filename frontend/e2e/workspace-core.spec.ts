import { expect, test, type Page } from "@playwright/test";

import { installAuth, makeJwt } from "./support/generated-api-auth";
import { captureScreen, installAppApiMocks } from "./support/app-mocks";
import { installMockStomp } from "./support/mock-stomp";

function dateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dashboardRangeQuery(period: "today" | "7d" | "30d"): string {
  const today = new Date();
  const from = new Date(today);
  if (period === "7d") {
    from.setDate(today.getDate() - 6);
  }
  if (period === "30d") {
    from.setDate(today.getDate() - 29);
  }
  return `from=${dateInputValue(from)}&to=${dateInputValue(today)}`;
}

function latestSeen(seen: string[], prefix: string): string {
  return [...seen].reverse().find((entry) => entry.startsWith(prefix)) ?? "";
}

async function readAuthStorage(page: Page) {
  return page.evaluate(() => {
    const rawUser = window.localStorage.getItem("user");
    let userName: string | null = null;
    if (rawUser) {
      try {
        userName = (JSON.parse(rawUser) as { name?: string }).name ?? null;
      } catch {
        userName = null;
      }
    }

    return {
      accessToken: window.localStorage.getItem("accessToken"),
      refreshToken: window.localStorage.getItem("refreshToken"),
      user: rawUser,
      userName,
    };
  });
}

async function expectLoginScreenWithoutWorkspaceData(page: Page) {
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "시스템 로그인" })).toBeVisible();
  await expect(page.getByTestId("workspace-marker")).toHaveCount(0);
  await expect(page.getByText("QA Workspace", { exact: true })).toHaveCount(0);
  await expect(page.getByText("총 상담", { exact: true })).toHaveCount(0);
  await expect(page.getByText("최신 도메인 후보 확정")).toHaveCount(0);
}

async function installLogoutAuthMocks(page: Page, authSeen: string[]) {
  await page.route("**/api/v1/auth/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    authSeen.push(`${method} ${path}`);

    if (method === "POST" && path === "/auth/refresh") {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ code: "UNAUTHORIZED", message: "인증이 필요합니다." }),
      });
      return;
    }

    if (method === "POST" && path === "/auth/login") {
      expect(request.postDataJSON()).toEqual({
        email: "new-agent@example.com",
        password: "password123",
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            accessToken: makeJwt(),
            refreshToken: "new-refresh-token",
            tokenType: "Bearer",
            expiresIn: 3600,
            user: {
              id: 17,
              email: "new-agent@example.com",
              name: "새 상담사",
              role: "OPERATOR",
            },
          },
        }),
      });
      return;
    }

    await route.fallback();
  });
}

test.describe("Workspace core operator screens", () => {
  let seen: string[];

  test.beforeEach(async ({ page }) => {
    seen = [];
    await installAuth(page);
    await installMockStomp(page);
    await installAppApiMocks(page, seen);
  });

  test.describe("Given an authenticated workspace operator", () => {
    test.describe("When they open the dashboard", () => {
      test("Then KPI, health, recommendation, and workflow ranking data are rendered", async ({
        page,
      }, testInfo) => {
        await page.goto("/workspaces/1/dashboard");

        await expect(page.getByRole("heading", { name: "대시보드", exact: true })).toBeVisible();
        await expect(page.getByText("총 상담")).toBeVisible();
        await expect(page.getByText("최신 도메인 후보 확정")).toBeVisible();
        await expect(page.getByText("환불 처리").first()).toBeVisible();
        await expect(page.getByText("검토 후 운영 반영을 기다리고 있습니다.")).toBeVisible();
        await captureScreen(page, testInfo, "workspace-dashboard");

        const range = dashboardRangeQuery("7d");
        expect(seen).toContain(`GET /workspaces/1/consultation/metrics?${range}`);
        expect(seen).toContain(`GET /workspaces/1/dashboard/action-recommendations?${range}`);
        expect(seen).toContain("GET /workspaces/1/dashboard/knowledge-pack-health");
        expect(seen).toContain(`GET /workspaces/1/dashboard/workflow-rankings?${range}`);
      });

      test("Then compact filter controls update summaries, date queries, and action navigation", async ({
        page,
      }) => {
        await page.goto("/workspaces/1/dashboard");

        await page.getByRole("button", { name: "오늘" }).click();
        await expect(page.getByLabel("대시보드 필터 요약")).toContainText("오늘");
        await expect
          .poll(() =>
            seen.includes(`GET /workspaces/1/consultation/metrics?${dashboardRangeQuery("today")}`),
          )
          .toBe(true);

        await page.getByLabel("운영 지식팩 버전 필터").selectOption("published");
        await page.getByLabel("채널 필터").selectOption("email");
        await page.getByLabel("워크플로우 상태 필터").selectOption("handoff");

        const summary = page.getByLabel("대시보드 필터 요약");
        await expect(summary).toContainText("운영 버전");
        await expect(summary).toContainText("이메일");
        await expect(summary).toContainText("상담원 연결");

        await page.getByRole("button", { name: "사용자 지정" }).click();
        await page.getByLabel("시작일").fill("2026-06-01");
        await page.getByLabel("종료일").fill("2026-06-03");
        await expect(summary).toContainText("2026-06-01 ~ 2026-06-03");
        await expect
          .poll(() =>
            seen.includes("GET /workspaces/1/consultation/metrics?from=2026-06-01&to=2026-06-03"),
          )
          .toBe(true);

        await page.getByRole("link", { name: /바로 보기/ }).click();
        await expect(page).toHaveURL(/\/workspaces\/1\/pipeline-jobs\/900\/review/);
        await expect(page.getByText("상담 도메인을 확정합니다.")).toBeVisible();
      });
    });

    test.describe("When they search and open a workspace workflow", () => {
      test("Then the workflow list settings and detail navigation are stable", async ({
        page,
      }, testInfo) => {
        await page.goto("/workspaces/1/workflows");
        await expect(page.getByTestId("workspace-workflows")).toBeVisible();

        await page.getByTestId("workspace-workflows-search-input").fill("환불");
        await page.getByTestId("workspace-workflows-search-item-401").click();
        await expect(page.getByTestId("workspace-workflows-filter-chip")).toContainText(
          "환불 처리",
        );

        await page.getByTestId("workspace-workflows-settings-toggle").click();
        await expect(page.getByTestId("workspace-workflows-settings")).toBeVisible();
        await captureScreen(page, testInfo, "workspace-workflows");

        await page.getByTestId("workspace-workflows-card-401-open").click();
        await expect(page).toHaveURL(
          /\/workspaces\/1\/domain-packs\/1\/workflows\/401\?versionId=1/,
        );
        await expect(page.getByText("주문번호를 확인하고 환불 정책에 따라 안내")).toBeVisible();
      });
    });

    test.describe("When they switch workspaces from the shell", () => {
      test("Then the marker opens the workspace list and navigates with the selected workspace id", async ({
        page,
      }, testInfo) => {
        await page.goto("/workspaces/1/dashboard");
        await expect(page.getByTestId("workspace-marker")).toContainText("QA Workspace");

        await page.getByTestId("workspace-marker").click();
        await expect(page.getByTestId("workspace-marker-menu")).toBeVisible();
        await expect(page.getByTestId("workspace-option-2")).toContainText("Ops Workspace");
        await captureScreen(page, testInfo, "workspace-switcher");

        await page.getByTestId("workspace-option-2").click();
        await expect(page).toHaveURL(/\/workspaces\/2\/workflows$/);
        await expect(page.getByTestId("workspace-marker")).toContainText("Ops Workspace");
        await expect(page.getByTestId("workspace-workflows")).toContainText("환불 처리");
        expect(seen).toContain("GET /workspaces/2");
        expect(seen).toContain("GET /workspaces/2/domain-packs");
        expect(seen).toContain("GET /workspaces/2/domain-packs/1");
        expect(seen).toContain("GET /workspaces/2/domain-packs/1/versions/1/workflows");
      });
    });

    test.describe("When they use the account menu", () => {
      test("Then settings feedback and logout clear the authenticated session @critical", async ({
        page,
      }, testInfo) => {
        const authSeen: string[] = [];
        await installLogoutAuthMocks(page, authSeen);
        await page.goto("/workspaces/1/dashboard");

        await page.getByTestId("account-menu-trigger").click();
        await expect(page.getByTestId("account-menu-popover")).toBeVisible();
        await captureScreen(page, testInfo, "workspace-account-menu");

        await page.getByTestId("account-menu-settings").click();
        await expect(page.getByText("설정 화면은 준비 중입니다.")).toBeVisible();

        await page.getByTestId("account-menu-trigger").click();
        await page.getByTestId("account-menu-logout").click();

        await expectLoginScreenWithoutWorkspaceData(page);
        await expect
          .poll(() => readAuthStorage(page))
          .toEqual({ accessToken: null, refreshToken: null, user: null, userName: null });

        const afterLogoutApiCount = seen.length;
        await page.goBack();
        await expectLoginScreenWithoutWorkspaceData(page);
        await expect
          .poll(() => readAuthStorage(page))
          .toEqual({ accessToken: null, refreshToken: null, user: null, userName: null });
        expect(seen.slice(afterLogoutApiCount).some((entry) => entry.startsWith("GET /workspaces")))
          .toBe(false);

        const afterBackApiCount = seen.length;
        await page.goto("/workspaces/1/dashboard");
        await expectLoginScreenWithoutWorkspaceData(page);
        await expect
          .poll(() => readAuthStorage(page))
          .toEqual({ accessToken: null, refreshToken: null, user: null, userName: null });
        expect(seen.slice(afterBackApiCount).some((entry) => entry.startsWith("GET /workspaces")))
          .toBe(false);
        expect(authSeen.filter((entry) => entry === "POST /auth/refresh").length).toBeGreaterThan(
          0,
        );

        await page.getByLabel("이메일 주소").fill("new-agent@example.com");
        await page.getByLabel("비밀번호").fill("password123");
        await page.getByRole("button", { name: "시스템 로그인" }).click();

        await expect(page).toHaveURL(/\/workspaces\/1\/dashboard$/);
        await expect(page.getByTestId("workspace-marker")).toContainText("QA Workspace");
        await expect(page.getByRole("heading", { name: "대시보드", exact: true })).toBeVisible();
        await expect(page.getByText("새 상담사")).toBeVisible();
        await expect
          .poll(() => readAuthStorage(page))
          .toEqual({
            accessToken: expect.any(String),
            refreshToken: null,
            user: expect.any(String),
            userName: "새 상담사",
          });
        expect(authSeen).toContain("POST /auth/login");
      });
    });

    test.describe("When they filter workspace members", () => {
      test("Then role and search filters drive the generated member endpoint", async ({ page }) => {
        await page.goto("/workspaces/1/settings/members");
        await expect(page.getByRole("heading", { name: "멤버" })).toBeVisible();
        await expect(page.getByText("김상담")).toBeVisible();

        await page.getByPlaceholder("이름 또는 이메일 검색").fill("리뷰");
        await page.getByLabel("역할 필터").selectOption("REVIEWER");

        await expect(page.getByText("박리뷰")).toBeVisible();
        await expect(page.getByText("김상담")).toBeHidden();
        expect(seen).toContain("GET /workspaces/1/members?q=%EB%A6%AC%EB%B7%B0&role=REVIEWER");

        await page.getByPlaceholder("이름 또는 이메일 검색").fill("없는멤버");
        await expect(page.getByTestId("workspace-members-empty")).toBeVisible();
        expect(seen).toContain(
          "GET /workspaces/1/members?q=%EC%97%86%EB%8A%94%EB%A9%A4%EB%B2%84&role=REVIEWER",
        );

        await page.getByLabel("역할 필터").selectOption("");
        await expect(page.getByTestId("workspace-members-empty")).toBeVisible();
        expect(seen).toContain("GET /workspaces/1/members?q=%EC%97%86%EB%8A%94%EB%A9%A4%EB%B2%84");
      });
    });

    test.describe("When they review consultation history", () => {
      test("Then search filters, empty state, detail navigation, and previous messages work", async ({
        page,
      }, testInfo) => {
        await page.goto("/workspaces/1/consultation/history");

        await expect(page.getByLabel("채팅 기록 목록")).toContainText("김민지");
        await expect(page.getByLabel("채팅 기록 목록")).not.toContainText("이준호");
        await expect(page.getByText("좌측 목록에서 세션을 선택해주세요")).toBeVisible();
        expect(seen).toContain(
          "GET /workspaces/1/consultation/sessions?status=COMPLETED&page=0&size=20",
        );

        await page.getByRole("textbox", { name: "상담 기록 검색" }).fill("배송");
        await page.getByRole("button", { name: "검색어로 상담 기록 검색" }).click();
        await expect(page.getByText("검색 조건에 맞는 상담 기록이 없습니다")).toBeVisible();
        await expect
          .poll(() =>
            seen.some(
              (entry) =>
                entry.startsWith("GET /workspaces/1/consultation/sessions?") &&
                entry.includes("status=COMPLETED") &&
                entry.includes("keyword=%EB%B0%B0%EC%86%A1"),
            ),
          )
          .toBe(true);

        await page.getByLabel("검색 필터 초기화").click();
        await expect(page.getByLabel("채팅 기록 목록")).toContainText("김민지");
        await page.getByLabel("상태 필터").selectOption("ALL");
        await page.getByRole("textbox", { name: "상담 기록 검색" }).fill("환불");
        await page.getByRole("button", { name: "검색어로 상담 기록 검색" }).click();
        await page.getByLabel("시작일 필터").fill("2026-06-01");
        await page.getByLabel("종료일 필터").fill("2026-06-04");
        await page.getByLabel("담당 상담사 필터").fill("7");

        await expect
          .poll(() =>
            seen.some(
              (entry) =>
                entry.startsWith("GET /workspaces/1/consultation/sessions?") &&
                !entry.includes("status=") &&
                entry.includes("keyword=%ED%99%98%EB%B6%88") &&
                entry.includes("startedFrom=2026-06-01") &&
                entry.includes("startedTo=2026-06-04") &&
                entry.includes("assignedCounselorId=7"),
            ),
          )
          .toBe(true);

        await page.getByRole("button", { name: /김민지/ }).click();
        await expect(page).toHaveURL(/\/workspaces\/1\/consultation\/history\/601\?/);
        await expect(page.getByLabel("채팅 메시지 내역")).toContainText(
          "환불 가능한지 확인해주세요.",
        );
        await expect(page.getByText("2/3개 메시지")).toBeVisible();

        await page.getByRole("button", { name: "이전 메시지 불러오기" }).click();
        await expect(page.getByText("환불 상담 세션이 시작되었습니다.")).toBeVisible();
        await expect(page.getByText("3/3개 메시지")).toBeVisible();
        expect(seen).toContain("GET /consultation/sessions/601/messages?page=1&size=50");
        await captureScreen(page, testInfo, "consultation-history");
      });
    });

    test.describe("When they upload consultation logs and enter pipeline review", () => {
      test("Then processing stays disabled and no upload request is sent without a file", async ({
        page,
      }) => {
        await page.goto("/workspaces/1/upload");
        await expect(page.getByRole("heading", { name: "상담 로그 업로드" })).toBeVisible();

        const startButton = page.getByRole("button", { name: "처리 시작" });
        await expect(startButton).toBeDisabled();
        await expect(page.getByText("파일을 먼저 선택해 주세요.")).toBeVisible();
        await expect(
          page.getByText("처리 시작 전에 ZIP 상담 로그 파일이 필요합니다."),
        ).toBeVisible();
        await expect(page.locator('input[type="file"]')).toBeEnabled();
        await expect(page).toHaveURL(/\/workspaces\/1\/upload$/);

        expect(seen).not.toContain("POST /workspaces/1/datasets/uploads:init");
        expect(seen).not.toContain("PUT /e2e-upload/raw-log.zip");
        expect(
          seen.some((entry) =>
            entry.includes("/pipeline-jobs/domain-pack-generation"),
          ),
        ).toBe(false);
      });

      test("Then ZIP이 아닌 상담 로그 파일은 업로드 전에 차단되고 ZIP 재선택은 가능하다", async ({
        page,
      }) => {
        await page.goto("/workspaces/1/upload");
        await expect(page.getByRole("heading", { name: "상담 로그 업로드" })).toBeVisible();

        const fileInput = page.locator('input[type="file"]');
        const startButton = page.getByRole("button", { name: "처리 시작" });
        const zipOnlyMessages = page.getByText("ZIP 파일만 업로드할 수 있습니다.");

        await fileInput.setInputFiles({
          name: "notes.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("plain text log"),
        });

        await expect(zipOnlyMessages).toHaveCount(1);
        await expect(startButton).toBeDisabled();
        await expect(page.getByText("파일을 먼저 선택해 주세요.")).toBeVisible();
        await expect(page.getByText("notes.txt")).not.toBeVisible();
        expect(seen).not.toContain("POST /workspaces/1/datasets/uploads:init");
        expect(seen).not.toContain("PUT /e2e-upload/raw-log.zip");
        expect(seen).not.toContain("POST /workspaces/1/datasets/uploads/77:complete");

        const dataTransfer = await page.evaluateHandle(() => {
          const transfer = new DataTransfer();
          transfer.items.add(
            new File(["conversation_id,message\n1,hello"], "call-log.csv", {
              type: "text/csv",
            }),
          );
          return transfer;
        });
        const dropZone = page
          .getByRole("heading", { name: "파일을 클릭하거나 끌어다 놓으세요" })
          .locator("xpath=..");

        await dropZone.dispatchEvent("drop", { dataTransfer });
        await dataTransfer.dispose();

        await expect(zipOnlyMessages).toHaveCount(2);
        await expect(startButton).toBeDisabled();
        await expect(page.getByText("call-log.csv")).not.toBeVisible();
        expect(seen).not.toContain("POST /workspaces/1/datasets/uploads:init");
        expect(seen).not.toContain("PUT /e2e-upload/raw-log.zip");
        expect(seen).not.toContain("POST /workspaces/1/datasets/uploads/77:complete");
        expect(
          seen.some((entry) =>
            entry.includes("/pipeline-jobs/domain-pack-generation"),
          ),
        ).toBe(false);

        await fileInput.setInputFiles({
          name: "refund-log.zip",
          mimeType: "application/zip",
          buffer: Buffer.from("PK\u0003\u0004-e2e"),
        });
        await expect(page.getByText("refund-log.zip")).toBeVisible();
        await expect(startButton).toBeEnabled();

        await startButton.click();
        await expect(page.getByText("업로드 완료").first()).toBeVisible();
        await expect(page.getByText("자동 생성 파이프라인")).toBeVisible();
        expect(seen).toContain("POST /workspaces/1/datasets/uploads:init");
        expect(seen).toContain("PUT /e2e-upload/raw-log.zip");
        expect(seen).toContain("POST /workspaces/1/datasets/uploads/77:complete");
        expect(seen).toContain(
          "GET /workspaces/1/datasets/77/pipeline-jobs/latest?jobType=INGESTION",
        );
      });

      test("Then upload, generation, review navigation, and domain confirmation are verified", async ({
        page,
      }, testInfo) => {
        await page.goto("/workspaces/1/upload");
        await expect(page.getByRole("heading", { name: "상담 로그 업로드" })).toBeVisible();

        await page.locator('input[type="file"]').setInputFiles({
          name: "refund-log.zip",
          mimeType: "application/zip",
          buffer: Buffer.from("PK\u0003\u0004-e2e"),
        });
        await page.getByRole("button", { name: "처리 시작" }).click();
        await expect(page.getByText("업로드 완료").first()).toBeVisible();
        await expect(page.getByText("자동 생성 파이프라인")).toBeVisible();
        await page.getByRole("button", { name: "검토 화면으로 이동" }).click();

        await expect(page).toHaveURL(/\/workspaces\/1\/pipeline-jobs\/900\/review/);
        await expect(page.getByText("상담 도메인을 확정합니다.")).toBeVisible();
        await expect(page.getByText("환불/결제 도메인")).toBeVisible();
        await captureScreen(page, testInfo, "pipeline-domain-review");

        await page.getByRole("button", { name: /환불\/결제 도메인/ }).click();
        await expect
          .poll(() =>
            seen.includes(
              "POST /workspaces/1/pipeline-jobs/900/review-checkpoint/domain-confirmation",
            ),
          )
          .toBe(true);
        expect(seen).toContain("POST /workspaces/1/datasets/uploads:init");
        expect(seen).toContain("PUT /e2e-upload/raw-log.zip");
        expect(seen).toContain("POST /workspaces/1/datasets/uploads/77:complete");
        expect(seen).toContain(
          "GET /workspaces/1/datasets/77/pipeline-jobs/latest?jobType=INGESTION",
        );
      });
    });

    test.describe("When they resolve a human feedback checkpoint", () => {
      test("Then the decision draft is submitted for replay", async ({ page }) => {
        await page.goto("/workspaces/1/pipeline-jobs/901/review");
        await expect(page.getByText("애매한 클러스터 경계를 확인합니다.")).toBeVisible();

        await page.getByRole("button", { name: "분리하기" }).click();
        await page.getByRole("button", { name: "피드백 반영 후 replay" }).click();

        await expect
          .poll(() =>
            seen.includes("POST /workspaces/1/pipeline-jobs/901/review-checkpoint/human-feedback"),
          )
          .toBe(true);
      });
    });

    test.describe("When they refresh pipeline review progress", () => {
      test("Then lookup failures show safe recovery and retry updates the same job", async ({
        page,
      }) => {
        await page.goto("/workspaces/1/pipeline-jobs/904/review");
        await expect(page.getByLabel("파이프라인 리뷰 맥락")).toContainText("상태 조회 실패");
        await expect(page.getByLabel("파이프라인 리뷰 맥락")).toContainText(
          "현재 job 상태 확인 불가",
        );
        await expect(page.getByRole("alert")).toContainText("현재 job 상태를 확인할 수 없습니다.");
        await expect(page.getByRole("link", { name: "업로드 화면으로 돌아가기" })).toHaveAttribute(
          "href",
          "/workspaces/1/upload",
        );
        await expect(page.getByRole("link", { name: "도메인팩 관리로 이동" })).toHaveCount(0);

        await page.getByRole("button", { name: "다시 시도" }).click();

        await expect(page).toHaveURL(/\/workspaces\/1\/pipeline-jobs\/904\/review/);
        await expect(page.getByLabel("파이프라인 리뷰 맥락")).toContainText("파이프라인 완료");
        await expect(page.getByText("리뷰 체크포인트가 완료되었습니다.")).toBeVisible();
        await expect(page.getByRole("link", { name: "도메인팩 관리로 이동" })).toBeVisible();
        await expect
          .poll(
            () =>
              seen.filter(
                (entry) => entry === "GET /workspaces/1/pipeline-jobs/904/review-checkpoint",
              ).length,
          )
          .toBeGreaterThanOrEqual(2);
      });

      test("Then the latest completion and failure actions replace the stale running state", async ({
        page,
      }) => {
        await page.goto("/workspaces/1/pipeline-jobs/902/review");
        await expect(page.getByLabel("파이프라인 리뷰 맥락")).toContainText("RUNNING");
        await expect(page.getByText("활성 리뷰 체크포인트가 없습니다.")).toBeVisible();

        await page.getByRole("button", { name: "상태 새로고침" }).click();

        await expect(page).toHaveURL(/\/workspaces\/1\/pipeline-jobs\/902\/review/);
        await expect(page.getByLabel("파이프라인 리뷰 맥락")).toContainText("파이프라인 완료");
        await expect(page.getByText("리뷰 체크포인트가 완료되었습니다.")).toBeVisible();
        await expect(page.getByRole("link", { name: "도메인팩 관리로 이동" })).toBeVisible();
        await expect
          .poll(
            () =>
              seen.filter(
                (entry) => entry === "GET /workspaces/1/pipeline-jobs/902/review-checkpoint",
              ).length,
          )
          .toBeGreaterThanOrEqual(2);

        await page.goto("/workspaces/1/pipeline-jobs/903/review");
        await expect(page.getByLabel("파이프라인 리뷰 맥락")).toContainText("RUNNING");

        await page.getByRole("button", { name: "상태 새로고침" }).click();

        await expect(page).toHaveURL(/\/workspaces\/1\/pipeline-jobs\/903\/review/);
        await expect(page.getByLabel("파이프라인 리뷰 맥락")).toContainText("파이프라인 실패");
        await expect(page.getByText("파이프라인이 실패했습니다.")).toBeVisible();
        await expect(page.getByRole("link", { name: "업로드 다시 시작" })).toBeVisible();
        await expect(page.getByRole("link", { name: "도메인팩 관리로 이동" })).toHaveCount(0);
        await expect
          .poll(
            () =>
              seen.filter(
                (entry) => entry === "GET /workspaces/1/pipeline-jobs/903/review-checkpoint",
              ).length,
          )
          .toBeGreaterThanOrEqual(2);
      });
    });

    test.describe("When they run a simulation and save feedback", () => {
      test("Then runtime state, feedback, and improvement candidate actions work", async ({
        page,
      }, testInfo) => {
        await page.goto("/workspaces/1/simulation");
        await expect(page.getByRole("heading", { name: "상담 시뮬레이션" })).toBeVisible();

        await page.getByLabel("고객 이름").fill("최시뮬");
        await page.getByLabel("시작 workflow 선택").selectOption("401");
        await page.getByRole("button", { name: "세션 생성" }).click();
        await expect(page.getByLabel("시뮬레이션 대화")).toContainText(
          "환불 처리 기준으로 응답합니다.",
        );
        await expect(page.getByText("고객 메시지를 입력하면 응답이 생성됩니다.")).toBeVisible();

        await page.getByRole("button", { name: "등록" }).click();
        await expect(
          page.getByText("고객 메시지가 있어야 검증 케이스로 저장할 수 있습니다."),
        ).toBeVisible();
        expect(
          seen.some(
            (entry) => entry === "POST /workspaces/1/simulation/sessions/8801/golden-cases",
          ),
        ).toBe(false);

        await page.getByPlaceholder("고객 역할 메시지 입력").fill("환불 가능한가요?");
        await page.getByRole("button", { name: "전송" }).click();
        await expect(page.getByText("주문번호를 알려주시면 환불 가능 여부")).toBeVisible();

        await page.getByLabel("검증 케이스 이름").fill("환불 주문번호 검증");
        await page.getByLabel("기대 action").selectOption("ASK_SLOT");
        await page.getByRole("button", { name: "등록" }).click();
        await expect(page.getByText("검증 케이스를 저장했습니다.")).toBeVisible();
        await expect(page.getByText("환불 주문번호 검증")).toBeVisible();
        expect(seen).toContain("POST /workspaces/1/simulation/sessions/8801/golden-cases");

        await page.getByLabel("Replay version").fill("");
        await page.getByRole("button", { name: "환불 주문번호 검증 replay" }).click();
        await expect(page.getByText("Replay version을 입력하세요.")).toBeVisible();
        expect(
          seen.some((entry) => entry === "POST /workspaces/1/simulation/golden-cases/9951/replays"),
        ).toBe(false);

        await page.getByLabel("Replay version").fill("2");
        await page.getByRole("button", { name: "환불 주문번호 검증 replay" }).click();
        await expect(page.getByText("검증 케이스 replay가 통과했습니다.")).toBeVisible();
        await expect(page.getByText("PASS")).toBeVisible();
        expect(seen).toContain("POST /workspaces/1/simulation/golden-cases/9951/replays");

        await page.getByLabel("Turn 2 피드백 대상 선택").click();
        await page.getByLabel("피드백 유형 선택").selectOption("MISSING_SLOT_QUESTION");
        await page.getByLabel("피드백 심각도 선택").selectOption("HIGH");
        await page.getByLabel("설명").fill("분류가 흔들립니다.");
        await page.getByLabel("기대 응답/행동").fill("환불 문의로 고정해야 합니다.");
        await page.getByRole("button", { name: "피드백 저장" }).click();
        await expect(page.getByText("시뮬레이션 피드백을 남겼습니다.")).toBeVisible();
        expect(seen).toContain("POST /workspaces/1/simulation/sessions/8801/feedback");

        await page.getByRole("button", { name: "후보" }).click();
        await expect(page.getByText("intent 설명/예시")).toBeVisible();
        await page.getByRole("button", { name: "리뷰 요청" }).click();
        await expect(page.getByText("개선 후보 상태를 변경했습니다.")).toBeVisible();
        expect(
          latestSeen(seen, "PATCH /workspaces/1/simulation/improvement-candidates/9911/status"),
        ).toBe("PATCH /workspaces/1/simulation/improvement-candidates/9911/status");
        await captureScreen(page, testInfo, "workspace-simulation");
      });

      test("Then improvement candidates can be approved and rejected into the quality loop", async ({
        page,
      }) => {
        await page.goto("/workspaces/1/simulation?candidateStatus=READY_FOR_REVIEW");
        await expect(page.getByRole("heading", { name: "상담 시뮬레이션" })).toBeVisible();
        await expect(page.getByRole("tab", { name: "개선 후보" })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await expect(page.getByLabel("개선 후보 상태 필터")).toHaveValue("READY_FOR_REVIEW");

        const approvalCard = page.locator("li").filter({
          hasText: "부분 환불 문의도 주문번호를 먼저 확인하도록 질문을 보강합니다.",
        });
        const rejectionCard = page.locator("li").filter({
          hasText: "고액 환불 handoff 조건을 완화합니다.",
        });
        await expect(approvalCard).toBeVisible();
        await expect(rejectionCard).toBeVisible();

        const approveButton = approvalCard.getByRole("button", { name: "승인" });
        await approveButton.click();
        await expect(approveButton).toBeDisabled();
        await expect(approvalCard.getByRole("button", { name: "반려" })).toBeDisabled();
        await expect(page.getByText("개선 후보를 초안 버전에 반영했습니다.")).toBeVisible();
        await expect(approvalCard).toHaveCount(0);
        await expect(rejectionCard).toBeVisible();
        expect(
          seen.filter(
            (entry) =>
              entry === "POST /workspaces/1/simulation/improvement-candidates/9912/approve",
          ),
        ).toHaveLength(1);
        expect(
          seen.some(
            (entry) =>
              entry === "POST /workspaces/1/simulation/improvement-candidates/9913/approve",
          ),
        ).toBe(false);

        const rejectPath = "POST /workspaces/1/simulation/improvement-candidates/9913/reject";
        const rejectCountBefore = seen.filter((entry) => entry === rejectPath).length;
        await rejectionCard.getByRole("button", { name: "반려" }).click();
        await expect(page.getByText("반려 사유를 입력하세요.")).toBeVisible();
        expect(seen.filter((entry) => entry === rejectPath)).toHaveLength(rejectCountBefore);

        await rejectionCard.getByLabel("개선 후보 반려 사유").fill("근거가 부족합니다.");
        const rejectButton = rejectionCard.getByRole("button", { name: "반려" });
        await rejectButton.click();
        await expect(rejectButton).toBeDisabled();
        await expect(page.getByText("개선 후보를 반려했습니다.")).toBeVisible();
        await expect(page.getByText("조건에 맞는 개선 후보가 없습니다.")).toBeVisible();
        expect(seen.filter((entry) => entry === rejectPath)).toHaveLength(
          rejectCountBefore + 1,
        );
        expect(
          seen.some(
            (entry) =>
              entry === "POST /workspaces/1/simulation/improvement-candidates/9912/reject",
          ),
        ).toBe(false);
      });
    });
  });
});

test.describe("Workspace dashboard Domain Pack health failure", () => {
  let seen: string[];

  test.beforeEach(async ({ page }) => {
    seen = [];
    await installAuth(page);
    await installMockStomp(page);
    await installAppApiMocks(page, seen, {
      dashboardKnowledgePackHealth: "error",
    });
  });

  test("When Domain Pack 상태 조회가 실패하면 안전한 오류와 재시도만 보여준다 @critical", async ({
    page,
  }) => {
    await page.goto("/workspaces/1/dashboard");

    await expect(page).toHaveURL(/\/workspaces\/1\/dashboard$/);
    await expect(page.getByTestId("workspace-marker")).toContainText("QA Workspace");
    await expect(page.getByRole("heading", { name: "대시보드", exact: true })).toBeVisible();

    const errorPanel = page.getByTestId("knowledge-health-error");
    await expect(errorPanel).toContainText("운영 지식팩 상태를 불러오지 못했습니다.");
    await expect(errorPanel.getByRole("button", { name: "다시 시도" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "운영 지식팩 건강도" })).toHaveCount(0);
    await expect(page.getByText("v1", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Generated API Pack")).toHaveCount(0);
    await expect(page.getByText("운영 지식팩이 아직 반영되지 않았습니다.")).toHaveCount(0);
    await expect(errorPanel.getByRole("link", { name: /상담 업로드/ })).toHaveCount(0);
    await expect(errorPanel.getByRole("link", { name: /지식팩 생성/ })).toHaveCount(0);

    const healthRequest = "GET /workspaces/1/dashboard/knowledge-pack-health";
    await expect.poll(() => seen.filter((entry) => entry === healthRequest).length).toBe(1);

    await errorPanel.getByRole("button", { name: "다시 시도" }).click();

    await expect
      .poll(() => seen.filter((entry) => entry === healthRequest).length)
      .toBeGreaterThan(1);
  });
});
