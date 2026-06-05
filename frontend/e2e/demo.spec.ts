import { expect, test } from "@playwright/test";

import { installMockStomp } from "./support/mock-stomp";

test.describe("Demo company picker", () => {
  test.beforeEach(async ({ page }) => {
    await installMockStomp(page);
  });

  test.describe("Given the demo company selection page", () => {
    test.describe("When a user picks the enabled company and enters a name", () => {
      test("Then it skips the name gate and opens the chat with the saved reply", async ({
        page,
      }) => {
        await page.route("**/api/v1/**", async (route) => {
          const request = route.request();
          const url = new URL(request.url());
          const path = url.pathname.replace(/^\/api\/v1/, "");
          const method = request.method();

          if (
            method === "POST" &&
            path === "/workspaces/1/demo/chat-sessions"
          ) {
            expect(request.postDataJSON()).toEqual({ customerName: "김민지" });
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                id: 91,
                status: "OPEN",
                channel: "DEMO",
                startedAt: "2026-05-22T00:00:00Z",
              }),
            });
            return;
          }

          if (
            method === "GET" &&
            path === "/workspaces/1/demo/chat-sessions/91/messages"
          ) {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify([]),
            });
            return;
          }

          if (
            method === "POST" &&
            path === "/workspaces/1/demo/chat-sessions/91/messages"
          ) {
            expect(request.postDataJSON()).toEqual({
              content: "환불 문의입니다",
            });
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify([
                {
                  id: 801,
                  seqNo: 1,
                  senderRole: "CUSTOMER",
                  messageType: "TEXT",
                  content: "환불 문의입니다",
                  createdAt: "2026-05-22T00:01:00Z",
                },
                {
                  id: 802,
                  seqNo: 2,
                  senderRole: "ASSISTANT",
                  messageType: "TEXT",
                  content: "환불 절차를 안내해드릴게요.",
                  createdAt: "2026-05-22T00:01:02Z",
                },
              ]),
            });
            return;
          }

          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({
              code: "E2E_UNMOCKED",
              message: `${method} ${path}`,
            }),
          });
        });

        await page.goto("/demo");
        await page.getByTestId("demo-company-card-1").click();
        await page.getByTestId("demo-name-input").fill("김민지");
        await page.getByTestId("demo-start-chat").click();

        await expect(page).toHaveURL(/\/demo\/chat\/1\?name=/);
        await expect(
          page.getByTestId("chat-conversation-screen"),
        ).toBeVisible();
        await expect(page.getByTestId("chat-entry-screen")).toHaveCount(0);
        await expect(page.getByText("아직 메시지가 없습니다. 첫 메시지를 보내보세요!")).toBeVisible();

        await page.getByLabel("메시지 입력").fill("환불 문의입니다");
        await page.getByRole("button", { name: "메시지 보내기" }).click();

        await expect(page.getByText("환불 문의입니다")).toBeVisible();
        await expect(
          page.getByText("환불 절차를 안내해드릴게요."),
        ).toBeVisible();
      });
    });

    test.describe("When a user focuses a preview company", () => {
      test("Then its info shows but the chat cannot be started", async ({
        page,
      }) => {
        await page.goto("/demo");
        await page.getByTestId("demo-company-card-3").click();

        await expect(page.getByTestId("demo-company-info")).toContainText(
          "인디고발리 숙소 예약",
        );
        await expect(page.getByTestId("demo-start-chat")).toBeDisabled();
      });
    });
  });
});
