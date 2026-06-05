import { expect, test } from "@playwright/test";

import { installAuth } from "./support/generated-api-auth";

test.describe("Workspace creation", () => {
  test.beforeEach(async ({ page }) => {
    await installAuth(page);
  });

  test.describe("Given the operator has no workspace", () => {
    test.describe("When the operator creates the first workspace", () => {
      test("Then the workspace is created and opened", async ({ page }) => {
        const seen: string[] = [];

        await page.route("**/api/v1/**", async (route) => {
          const request = route.request();
          const url = new URL(request.url());
          const path = url.pathname.replace(/^\/api\/v1/, "");
          const method = request.method();
          seen.push(`${method} ${path}`);

          if (method === "GET" && path === "/workspaces") {
            await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
            return;
          }

          if (method === "POST" && path === "/workspaces") {
            const body = request.postDataJSON() as { name?: string; workspaceKey?: string };
            expect(body.name).toBe("QA Workspace");
            expect(body.workspaceKey).toMatch(/^qa-workspace-[a-z0-9]+$/);
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                data: {
                  id: 777,
                  workspaceKey: "qa-workspace",
                  name: "QA Workspace",
                  status: "ACTIVE",
                  myRole: "OWNER",
                },
              }),
            });
            return;
          }

          if (method === "GET" && path === "/workspaces/777") {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                id: 777,
                workspaceKey: "qa-workspace",
                name: "QA Workspace",
                status: "ACTIVE",
                myRole: "OWNER",
              }),
            });
            return;
          }

          if (method === "GET" && path === "/workspaces/777/domain-packs") {
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

        await page.goto("/workspaces");
        await expect(page.getByRole("heading", { name: "워크스페이스 생성" })).toBeVisible();
        await page.getByLabel("제목").fill("QA Workspace");
        await page.getByRole("button", { name: "생성" }).click();

        await expect(page).toHaveURL(/\/workspaces\/777\/upload/);
        await expect(page.getByText("워크스페이스를 생성했습니다.")).toBeVisible();
        await expect(page.getByRole("heading", { name: "상담 로그 업로드" })).toBeVisible();
        expect(seen).toContain("POST /workspaces");
      });
    });
  });
});
