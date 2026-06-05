import { expect, test } from "@playwright/test";

import { installAuth } from "./support/generated-api-auth";
import { installMockStomp } from "./support/mock-stomp";

test.describe("User demo chat", () => {
  test.beforeEach(async ({ page }) => {
    await installMockStomp(page);
  });

  test.describe("Given a demo workspace chat entry point", () => {
    test.describe("When a user starts a chat and sends a message", () => {
      test("Then blank customer names are blocked before any session request", async ({ page }) => {
        const seen: string[] = [];

        await page.route("**/api/v1/**", async (route) => {
          const request = route.request();
          const url = new URL(request.url());
          const path = url.pathname.replace(/^\/api\/v1/, "");
          seen.push(`${request.method()} ${path}`);
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ code: "E2E_UNEXPECTED_API", message: path }),
          });
        });

        await page.goto("/demo/chat/42");
        await page.getByTestId("chat-name-input").fill("   ");
        await page.getByRole("button", { name: "미리보기 시작" }).click();

        await expect(page.getByTestId("chat-name-error")).toHaveText("이름을 입력해 주세요.");
        expect(seen).toEqual([]);
      });

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
        await page.getByRole("button", { name: "미리보기 시작" }).click();

        await expect(
          page.getByTestId("chat-conversation-screen"),
        ).toBeVisible();
        await expect(page.getByText("아직 메시지가 없습니다. 첫 메시지를 보내보세요!")).toBeVisible();

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
        const seen: string[] = [];

        await page.route("**/api/v1/**", async (route) => {
          const request = route.request();
          const url = new URL(request.url());
          const path = url.pathname.replace(/^\/api\/v1/, "");
          const method = request.method();
          seen.push(`${method} ${path}`);

          if (method === "POST" && path === "/workspaces/42/demo/chat-sessions") {
            expect(request.postDataJSON()).toEqual({ customerName: "김민지" });
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                id: 78,
                status: "OPEN",
                channel: "DEMO",
                startedAt: "2026-05-22T00:00:00Z",
              }),
            });
            return;
          }

          if (method === "GET" && path === "/workspaces/42/demo/chat-sessions/78/messages") {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify([]),
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

        await page.goto(
          "/demo/workspaces/42/chat?name=%EA%B9%80%EB%AF%BC%EC%A7%80",
        );

        await expect(page).toHaveURL(/\/demo\/chat\/42\?name=/);
        await expect(page.getByTestId("chat-conversation-screen")).toBeVisible();
        await expect.poll(() => seen).toContain("POST /workspaces/42/demo/chat-sessions");
      });
    });
  });

  test.describe("Given an authenticated workspace chat entry point", () => {
    test("Then saved session restore, fresh session creation, and realtime send are verified", async ({
      page,
    }) => {
      const seen: string[] = [];

      await installAuth(page, { name: "김민지" });
      await page.route("**/api/v1/**", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname.replace(/^\/api\/v1/, "");
        const method = request.method();
        seen.push(`${method} ${path}${url.search}`);

        if (method === "GET" && path === "/workspaces/1/chat/sessions/current") {
          expect(url.searchParams.get("customerName")).toBe("김민지");
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              id: 88,
              workspaceId: 1,
              status: "OPEN",
              channel: "WEB",
              startedAt: "2026-06-04T09:00:00Z",
            }),
          });
          return;
        }

        if (method === "POST" && path === "/workspaces/1/chat/sessions") {
          expect(request.postDataJSON()).toEqual({ customerName: "김민지" });
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              id: 89,
              workspaceId: 1,
              status: "OPEN",
              channel: "WEB",
              startedAt: "2026-06-04T09:05:00Z",
            }),
          });
          return;
        }

        if (method === "GET" && path === "/consultation/sessions/88/messages") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([
              {
                id: 8801,
                seqNo: 1,
                senderRole: "ASSISTANT",
                messageType: "TEXT",
                content: "이전 상담을 이어서 도와드릴게요.",
                createdAt: "2026-06-04T09:01:00Z",
              },
            ]),
          });
          return;
        }

        if (method === "GET" && path === "/consultation/sessions/89/messages") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([]),
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

      await page.goto("/chat/1");

      await expect(page.getByTestId("chat-conversation-screen")).toBeVisible();
      await expect(page.getByTestId("chat-meta-strip")).toContainText("연결됨");
      await expect(page.getByTestId("chat-session-reuse-note")).toContainText("김민지");
      await expect(page.getByText("이전 상담을 이어서 도와드릴게요.")).toBeVisible();
      expect(seen).toContain(
        "GET /workspaces/1/chat/sessions/current?customerName=%EA%B9%80%EB%AF%BC%EC%A7%80",
      );
      expect(seen).toContain("GET /consultation/sessions/88/messages");

      await page.getByTestId("chat-new-session-button").click();
      await expect(page.getByText("아직 메시지가 없습니다. 첫 메시지를 보내보세요!")).toBeVisible();
      await expect.poll(() => seen).toContain("POST /workspaces/1/chat/sessions");
      await expect.poll(() => seen).toContain("GET /consultation/sessions/89/messages");

      await page.getByLabel("메시지 입력").fill("환불 규정을 알려주세요");
      await page.getByRole("button", { name: "메시지 보내기" }).click();
      await expect(page.getByText("환불 규정을 알려주세요")).toBeVisible();
      await expect(page.getByTestId("bot-typing-indicator")).toBeVisible();

      const frames = await page.evaluate(() => {
        const state = window as Window & { __e2eWsFrames?: string[] };
        return state.__e2eWsFrames ?? [];
      });
      expect(
        frames.some(
          (frame) =>
            frame.includes("SEND") &&
            frame.includes("/app/chat.sendMessage") &&
            frame.includes('"sessionId":89') &&
            frame.includes("환불 규정을 알려주세요"),
        ),
      ).toBe(true);
    });
  });
});
