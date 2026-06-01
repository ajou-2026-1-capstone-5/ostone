import { expect, test } from "@playwright/test";

import { installMockStomp } from "./support/mock-stomp";

test.describe("User demo chat", () => {
  test.beforeEach(async ({ page }) => {
    await installMockStomp(page);
  });

  test.describe("Given a demo workspace chat entry point", () => {
    test.describe("When a user starts a chat and sends a message", () => {
      test("Then the screen creates the session and renders the saved reply", async ({
        page,
      }) => {
        const seen: string[] = [];

        await page.route("**/api/v1/**", async (route) => {
          const request = route.request();
          const url = new URL(request.url());
          const path = url.pathname.replace(/^\/api\/v1/, "");
          const method = request.method();
          seen.push(`${method} ${path}`);

          if (
            method === "POST" &&
            path === "/workspaces/42/demo/chat-sessions"
          ) {
            expect(request.postDataJSON()).toEqual({ customerName: "김민지" });
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                id: 77,
                status: "OPEN",
                channel: "DEMO",
                startedAt: "2026-05-22T00:00:00Z",
              }),
            });
            return;
          }

          if (
            method === "GET" &&
            path === "/workspaces/42/demo/chat-sessions/77/messages"
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
            path === "/workspaces/42/demo/chat-sessions/77/messages"
          ) {
            expect(request.postDataJSON()).toEqual({
              content: "배송 문의입니다",
            });
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify([
                {
                  id: 701,
                  seqNo: 1,
                  senderRole: "CUSTOMER",
                  messageType: "TEXT",
                  content: "배송 문의입니다",
                  createdAt: "2026-05-22T00:01:00Z",
                },
                {
                  id: 702,
                  seqNo: 2,
                  senderRole: "ASSISTANT",
                  messageType: "TEXT",
                  content: "배송 상태를 확인해드릴게요.",
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

        await page.goto("/demo/chat/42");
        await page.getByTestId("chat-name-input").fill("김민지");
        await page.getByRole("button", { name: "채팅 시작" }).click();

        await expect(
          page.getByTestId("chat-conversation-screen"),
        ).toBeVisible();
        await expect(
          page.getByText("안녕하세요, 김민지님. 무엇을 도와드릴까요?"),
        ).toBeVisible();

        await page.getByLabel("메시지 입력").fill("배송 문의입니다");
        await page.getByRole("button", { name: "메시지 보내기" }).click();

        await expect(page.getByText("배송 문의입니다")).toBeVisible();
        await expect(
          page.getByText("배송 상태를 확인해드릴게요."),
        ).toBeVisible();
        expect(seen).toContain("POST /workspaces/42/demo/chat-sessions");
        expect(seen).toContain(
          "POST /workspaces/42/demo/chat-sessions/77/messages",
        );
      });

      test("Then the legacy workspace URL redirects to the canonical chat URL", async ({
        page,
      }) => {
        await page.goto(
          "/demo/workspaces/42/chat?name=%EA%B9%80%EB%AF%BC%EC%A7%80",
        );

        await expect(page).toHaveURL(/\/demo\/chat\/42\?name=/);
      });
    });
  });
});
