import { expect, type Page, test } from "@playwright/test";

import { installAuth } from "./support/generated-api-auth";

const createdWorkspace = {
  id: 777,
  workspaceKey: "qa-workspace",
  name: "QA Workspace",
  status: "ACTIVE",
  myRole: "OWNER",
};

async function mockWorkspaceCreation(page: Page, seen: string[]) {
  let hasCreatedWorkspace = false;

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    seen.push(`${method} ${path}`);

    if (method === "GET" && path === "/workspaces") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(hasCreatedWorkspace ? [createdWorkspace] : []),
      });
      return;
    }

    if (method === "POST" && path === "/workspaces") {
      const body = request.postDataJSON() as { name?: string; workspaceKey?: string };
      expect(body.name).toBe("QA Workspace");
      expect(body.workspaceKey).toMatch(/^qa-workspace-[a-z0-9]+$/);
      hasCreatedWorkspace = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: createdWorkspace }),
      });
      return;
    }

    if (method === "GET" && path === "/workspaces/777") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createdWorkspace),
      });
      return;
    }

    if (method === "GET" && path === "/workspaces/777/subscription") {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          code: "SUBSCRIPTION_NOT_FOUND",
          message: "구독 정보가 없습니다.",
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
}

test.describe("Workspace creation", () => {
  test.beforeEach(async ({ page }) => {
    await installAuth(page);
  });

  test.describe("Given the operator has no workspace", () => {
    test.describe("When the operator submits invalid workspace names", () => {
      test("Then creation is blocked until the name is corrected", async ({ page }) => {
        const seen: string[] = [];
        await mockWorkspaceCreation(page, seen);

        await page.goto("/workspaces");
        await expect(page.getByRole("heading", { name: "워크스페이스 생성" })).toBeVisible();

        const nameInput = page.getByLabel("이름");
        const submitButton = page.getByRole("button", { name: "생성" });

        await submitButton.click();
        await expect(page.getByRole("alert")).toContainText("이름을 입력해주세요.");
        await expect(nameInput).toHaveAttribute("aria-invalid", "true");
        expect(seen).not.toContain("POST /workspaces");

        await nameInput.fill("   ");
        await submitButton.click();
        await expect(page.getByRole("alert")).toContainText("이름을 입력해주세요.");
        expect(seen).not.toContain("POST /workspaces");

        await nameInput.fill("a".repeat(256));
        await submitButton.click();
        await expect(page.getByRole("alert")).toContainText("이름은 255자 이하여야 합니다.");
        await expect(page).toHaveURL(/\/workspaces$/);
        expect(seen).not.toContain("POST /workspaces");

        await nameInput.fill("QA Workspace");
        await submitButton.click();

        await expect(page).toHaveURL(/\/workspaces\/777\/upload/);
        await expect(page.getByText("워크스페이스를 생성했습니다.")).toBeVisible();
        await expect(page.getByRole("heading", { name: "상담 로그 업로드" })).toBeVisible();
        expect(seen).toContain("POST /workspaces");
      });
    });

    test.describe("When the operator creates the first workspace", () => {
      test("Then the created workspace opens upload and keeps its context after reload", async ({
        page,
      }) => {
        const seen: string[] = [];
        await mockWorkspaceCreation(page, seen);

        await page.goto("/workspaces");
        await expect(page.getByRole("heading", { name: "워크스페이스 생성" })).toBeVisible();
        await page.getByLabel("이름").fill("QA Workspace");
        await page.getByRole("button", { name: "생성" }).click();

        await expect(page).toHaveURL(/\/workspaces\/777\/upload$/);
        await expect(page.getByText("워크스페이스를 생성했습니다.")).toBeVisible();
        await expect(page.getByRole("heading", { name: "상담 로그 업로드" })).toBeVisible();
        await expect(page.locator('input[type="file"]')).toBeEnabled();
        await expect(page.getByText("무료 온보딩 가능")).toBeVisible();
        await expect(page.getByTestId("workspace-marker")).toContainText("QA Workspace");
        await expect(page.getByTestId("sidebar-link-upload")).toHaveAttribute(
          "href",
          "/workspaces/777/upload",
        );
        await expect(page.getByTestId("sidebar-link-upload")).toHaveAttribute("data-active", "true");

        await page.getByTestId("workspace-marker").click();
        await expect(page.getByTestId("workspace-marker-menu")).toBeVisible();
        await expect(page.getByTestId("workspace-option-777")).toContainText("QA Workspace");
        await expect(page.getByTestId("workspace-marker-menu")).not.toContainText("Ops Workspace");

        await page.reload();
        await expect(page).toHaveURL(/\/workspaces\/777\/upload$/);
        await expect(page.getByTestId("workspace-marker")).toContainText("QA Workspace");
        await expect(page.getByRole("heading", { name: "상담 로그 업로드" })).toBeVisible();
        await expect(page.locator('input[type="file"]')).toBeEnabled();

        expect(seen).toContain("POST /workspaces");
        expect(seen).toContain("GET /workspaces/777");
        expect(seen).not.toContain("GET /workspaces/1");
      });
    });
  });
});
