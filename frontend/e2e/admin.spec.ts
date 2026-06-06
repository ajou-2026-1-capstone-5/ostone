import { expect, test } from "@playwright/test";

import { installAuth } from "./support/generated-api-auth";
import { captureScreen, installAdminApiMocks } from "./support/app-mocks";

test.describe("Admin console screens", () => {
  let seen: string[];

  test.beforeEach(async ({ page }) => {
    seen = [];
    await installAuth(page, {
      role: "SUPER_ADMIN",
      name: "관리자",
      email: "admin@example.com",
    });
    await installAdminApiMocks(page, seen);
  });

  test.describe("Given a SUPER_ADMIN session", () => {
    test.describe("When they inspect customers", () => {
      test("Then customer list search and detail panels render operational data", async ({
        page,
      }, testInfo) => {
        await page.goto("/admin/customers");
        await expect(page.getByRole("heading", { name: "고객사 현황" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "QA Workspace" })).toBeVisible();
        await expect(page.getByText("멤버 요약")).toBeVisible();

        await page.getByPlaceholder("고객사명 또는 workspace key").fill("QA");
        await page.getByRole("button", { name: "검색" }).click();
        await expect(page.getByText("refund-log.zip")).toBeVisible();
        await captureScreen(page, testInfo, "admin-customers");

        expect(seen).toContain("GET /admin/customers?page=0&size=20");
        expect(seen).toContain("GET /admin/customers/1");
        expect(seen).toContain("GET /admin/customers?page=0&size=20&q=QA");
      });
    });

    test.describe("When they refund a customer payment from admin billing", () => {
      test("Then the full refund endpoint receives the entered reason", async ({ page }) => {
        await page.goto("/admin/billing");
        await expect(page.getByRole("heading", { name: "결제 관리" })).toBeVisible();
        await expect(page.getByText("QA Workspace")).toBeVisible();

        await page.getByRole("button", { name: "전체 환불" }).click();
        await expect(page.getByRole("dialog")).toContainText("QA Workspace 전체 환불");
        await page.getByPlaceholder("고객 요청으로 전체 환불").fill("관리자 검증 환불");
        await page.getByRole("button", { name: "전체 환불 실행" }).click();

        await expect(page.getByText("전체 환불이 완료되었습니다.")).toBeVisible();
        expect(seen).toContain("POST /admin/billing/payments/7001/refunds");
      });
    });

    test.describe("When they retry a failed pipeline job", { tag: "@critical" }, () => {
      test("Then Airflow filters are normalized into the list query and can be reset", async ({
        page,
      }) => {
        await page.goto("/admin/airflow");
        await expect(page.getByRole("heading", { name: "Airflow 운영" })).toBeVisible();

        await page.getByLabel("Status").selectOption("FAILED");
        await page.getByLabel("Workspace").fill("1");
        await page.getByLabel("DAG").fill("domain_pack_generation");
        await page.getByRole("textbox", { name: "Run" }).fill("pipeline_job_8001");
        await page.getByLabel("Lag threshold").fill("120");
        await page.getByRole("button", { name: "조회" }).click();

        await expect
          .poll(() =>
            [...seen]
              .reverse()
              .find((entry) => entry.startsWith("GET /admin/pipeline-jobs?")) ?? "",
          )
          .toContain("status=FAILED");
        const filteredRequest =
          [...seen].reverse().find((entry) => entry.startsWith("GET /admin/pipeline-jobs?")) ?? "";
        expect(filteredRequest).toContain("workspaceId=1");
        expect(filteredRequest).toContain("dagId=domain_pack_generation");
        expect(filteredRequest).toContain("runId=pipeline_job_8001");
        expect(filteredRequest).toContain("lagThresholdSeconds=120");

        await page.getByRole("button", { name: "초기화" }).click();
        await expect(page.getByLabel("Status")).toHaveValue("");
        await expect(page.getByLabel("Workspace")).toHaveValue("");
        await expect(page.getByLabel("DAG")).toHaveValue("");
        await expect(page.getByRole("textbox", { name: "Run" })).toHaveValue("");
        await expect(page.getByLabel("Lag threshold")).toHaveValue("300");
      });

      test("Then Airflow operation calls the retry endpoint", async ({ page }) => {
        await page.goto("/admin/airflow");
        await expect(page.getByRole("heading", { name: "Airflow 운영" })).toBeVisible();
        await expect(page.getByText("draft generation timeout")).toBeVisible();

        await page.getByLabel("pipeline job 8001 재시도").click();
        await expect(page.getByText("새 pipeline job #8002을 생성했습니다.")).toBeVisible();
        expect(seen).toContain("POST /admin/pipeline-jobs/8001/retry");
      });
    });

    test.describe("When they create another SUPER_ADMIN account", () => {
      test("Then the form posts validated account data and shows the created role", async ({
        page,
      }) => {
        await page.goto("/admin/super-admins");
        await expect(page.getByRole("heading", { name: "관리자 계정" })).toBeVisible();

        await page.getByLabel("이름").fill("운영 관리자");
        await page.getByLabel("이메일").fill("super-admin@example.com");
        await page.getByLabel("임시 비밀번호").fill("password123");
        await page.getByRole("button", { name: "SUPER_ADMIN 생성" }).click();

        await expect(page.getByText("super-admin@example.com")).toBeVisible();
        await expect(page.getByText("SUPER_ADMIN", { exact: true })).toBeVisible();
        expect(seen).toContain("POST /admin/super-admins");
      });
    });
  });
});
