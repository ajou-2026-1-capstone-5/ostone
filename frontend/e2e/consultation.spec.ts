import { expect, test, type Page } from "@playwright/test";

import { captureScreen } from "./support/app-mocks";
import { installAuth } from "./support/generated-api-auth";
import { installConsultationApiMocks } from "./support/generated-api-mocks";
import { installMockStomp } from "./support/mock-stomp";

test.describe("Consultation screen", () => {
  let seen: string[];
  let messageEvidenceDelayMs: number;
  let shouldFailMessageEvidence: boolean;

  test.beforeEach(async ({ page }) => {
    seen = [];
    messageEvidenceDelayMs = 0;
    shouldFailMessageEvidence = false;
    await installAuth(page);
    await installMockStomp(page);
    await installConsultationApiMocks(page, seen, {
      messageEvidenceDelayMs: () => messageEvidenceDelayMs,
      shouldFailMessageEvidence: () => shouldFailMessageEvidence,
    });
  });

  async function openGeneratedConsultationMessage(page: Page) {
    await page.goto("/workspaces/1/consultation");
    await expect(page.getByText("김민지")).toBeVisible();

    await page.getByText("김민지").click();
    await expect(page.getByText("generated 상담 메시지")).toBeVisible();
    await expect(page.getByTestId("matched-workflow-bar")).toBeVisible();

    await page.getByRole("button", { name: /generated 상담 메시지/ }).click();
  }

  test.describe("Given an active consultation session from the generated queue endpoint", () => {
    test.describe("When an operator opens the session and completes it", () => {
      test("Then the screen loads generated messages and sends the status update", async ({
        page,
      }) => {
        await page.goto("/workspaces/1/consultation");
        await expect(page.getByText("김민지")).toBeVisible();

        await page.getByText("김민지").click();

        await expect(page.getByText("generated 상담 메시지")).toBeVisible();
        await expect(page.getByText("상담 종료")).toBeEnabled();
        await page.getByText("상담 종료").click();
        await page.getByRole("button", { name: /후속 연락 필요/ }).click();
        await page.getByLabel("종료 사유 또는 내부 메모").fill("배송사 확인 후 연락");
        await page.getByRole("button", { name: "종료 확인" }).click();
        await expect(page.getByText("상담이 종료되었습니다.")).toBeVisible();
        expect(seen).toContain("GET /workspaces/1/consultation/queue");
        expect(seen).toContain("GET /consultation/sessions/601/messages?page=0&size=50");
        expect(seen).toContain("PATCH /consultation/sessions/601/status");
      });
    });

    test.describe("When an operator sends a counselor message", () => {
      test("Then the chat renders the optimistic counselor message", async ({ page }) => {
        await page.goto("/workspaces/1/consultation");
        await expect(page.getByText("김민지")).toBeVisible();

        await page.getByText("김민지").click();
        await expect(page.getByText("generated 상담 메시지")).toBeVisible();
        await page.getByPlaceholder("메시지를 입력하세요...").fill("상담사 확인했습니다");
        await page.getByRole("button", { name: "메시지 전송" }).click();

        await expect(page.getByText("상담사 확인했습니다")).toBeVisible();
      });
    });

    test.describe("When the viewport is narrow (≤1180px)", () => {
      test("Then the right context opens in a non-modal drawer without blocking the composer", async ({
        page,
      }) => {
        await page.setViewportSize({ width: 1024, height: 800 });
        await page.goto("/workspaces/1/consultation");
        await expect(page.getByText("김민지")).toBeVisible();

        await page.getByText("김민지").click();
        await expect(page.getByText("generated 상담 메시지")).toBeVisible();

        // 우측 컨텍스트는 트리거로 열기 전까지 숨겨져 있다.
        const drawer = page.getByRole("complementary", { name: "고객 컨텍스트" });
        await page.getByTestId("open-context-drawer").click();
        await expect(drawer).toBeVisible();

        // 비모달: 패널이 열려 있어도 작성칸에 계속 입력할 수 있다.
        const composer = page.getByPlaceholder("메시지를 입력하세요...");
        await composer.fill("패널을 열어둔 채 작성");
        await expect(composer).toHaveValue("패널을 열어둔 채 작성");

        // 패널을 닫아도 작성 중 메시지는 보존된다.
        await page.getByRole("button", { name: "컨텍스트 닫기" }).click();
        await expect(drawer).toBeHidden();
        await expect(composer).toHaveValue("패널을 열어둔 채 작성");
      });
    });

    test.describe("When an operator opens the matched workflow", () => {
      test("Then the workflow preview and domain pack detail route are connected", async ({
        page,
      }, testInfo) => {
        await page.goto("/workspaces/1/consultation");
        await page.getByText("김민지").click();

        await expect(page.getByTestId("matched-workflow-bar")).toBeVisible();
        await expect(page.getByTestId("matched-workflow-bar-title")).toContainText("환불 처리");
        await page.getByTestId("matched-workflow-bar").hover();
        await expect(page.getByTestId("matched-workflow-bar-basis")).toContainText(
          "환불 조건 확인",
        );
        await captureScreen(page, testInfo, "consultation-matched-workflow");

        await page.getByTestId("matched-workflow-bar-open").click();
        await expect(page).toHaveURL(
          /\/workspaces\/1\/domain-packs\/1\/workflows\/401\?versionId=1/,
        );
        await expect(page.getByText("환불 workflow")).toBeVisible();
        expect(seen).toContain("GET /consultation/sessions/601/matched-workflow");
        expect(seen).toContain("GET /workspaces/1/domain-packs/1/versions/1/workflows/401");
      });
    });

    test.describe("When an operator selects a customer message with domain pack evidence", () => {
      test("Then slot, policy, and risk evidence render and navigate to their detail routes", async ({
        page,
      }) => {
        const evidenceTargets = [
          {
            tag: /배송 주소/,
            url: /\/workspaces\/1\/domain-packs\/1\/slots\/301\?versionId=1/,
            detailText: "배송지 주소",
            seenRequest: "GET /workspaces/1/domain-packs/1/versions/1/slots/301",
          },
          {
            tag: /환불 정책/,
            url: /\/workspaces\/1\/domain-packs\/1\/policies\/101\?versionId=1/,
            detailText: "환불 승인 조건",
            seenRequest: "GET /workspaces/1/domain-packs/1/versions/1/policies/101",
          },
          {
            tag: /사기 위험/,
            url: /\/workspaces\/1\/domain-packs\/1\/risks\/201\?versionId=1/,
            detailText: "부정 거래 징후",
            seenRequest: "GET /workspaces/1/domain-packs/1/versions/1/risks/201",
          },
        ] as const;

        messageEvidenceDelayMs = 100;

        for (const target of evidenceTargets) {
          await openGeneratedConsultationMessage(page);

          await expect(page.getByTestId("message-domain-loading")).toContainText(
            "근거를 불러오는 중입니다",
          );
          const evidencePanel = page.locator("aside").filter({ hasText: "확인 항목" });
          await expect(evidencePanel).toBeVisible();
          await expect(evidencePanel.getByText("응대 기준")).toBeVisible();
          await expect(evidencePanel.getByText("주의 사항")).toBeVisible();
          await expect(evidencePanel.getByText("ORD-20260604")).toBeVisible();
          await expect(evidencePanel.getByRole("button", { name: /배송 주소/ })).toBeVisible();
          await expect(evidencePanel.getByRole("button", { name: /환불 정책/ })).toBeVisible();
          await expect(evidencePanel.getByRole("button", { name: /사기 위험/ })).toBeVisible();

          await evidencePanel.getByRole("button", { name: target.tag }).click();

          await expect(page).toHaveURL(target.url);
          await expect(page.getByText(target.detailText)).toBeVisible();
          expect(seen).toContain("GET /consultation/sessions/601/messages/701/domain-pack-elements");
          expect(seen).toContain(target.seenRequest);
        }
      });
    });

    test.describe("When selected message evidence fails to load", () => {
      test("Then the consultation input and close-session action remain usable", async ({
        page,
      }) => {
        shouldFailMessageEvidence = true;

        await openGeneratedConsultationMessage(page);

        await expect(page.getByTestId("message-domain-error")).toContainText(
          "근거를 불러오지 못했습니다",
        );
        await expect(page.getByTestId("message-domain-error")).toContainText(
          "상담은 계속 진행할 수 있습니다. 잠시 후 메시지를 다시 선택해 주세요.",
        );

        const composer = page.getByPlaceholder("메시지를 입력하세요...");
        await expect(composer).toBeEnabled();
        await composer.fill("근거 조회 실패 후에도 상담은 계속됩니다");
        await expect(composer).toHaveValue("근거 조회 실패 후에도 상담은 계속됩니다");
        await expect(page.getByText("상담 종료")).toBeEnabled();
        expect(seen).toContain("GET /consultation/sessions/601/messages/701/domain-pack-elements");
      });
    });

    test.describe("When an operator narrows and sorts the queue", () => {
      test("Then the visible sessions follow the selected controls", async ({ page }, testInfo) => {
        await page.goto("/workspaces/1/consultation");

        const queueItems = page
          .locator("aside")
          .getByRole("button")
          .filter({ hasText: /김민지|박준호|이서연|최하늘/ });
        await expect(page.getByText("연결 요청 2건 · 미배정 2건 · 진행 4건")).toBeVisible();
        await expect(queueItems.first()).toContainText("김민지");

        await page.getByLabel("상담 큐 정렬").getByRole("button", { name: "최신순" }).click();
        await expect(
          page.getByLabel("상담 큐 정렬").getByRole("button", { name: "최신순" }),
        ).toHaveAttribute("aria-pressed", "true");
        await expect(queueItems.first()).toContainText("최하늘");

        await page
          .getByLabel("상담 큐 필터")
          .getByRole("button", { name: /상담사 연결 요청/ })
          .click();
        await expect(queueItems).toHaveCount(2);
        await expect(page.getByText("김민지")).toBeVisible();
        await expect(page.getByText("박준호")).toBeVisible();
        await expect(page.getByText("이서연")).not.toBeVisible();

        await page.getByLabel("상담 큐 검색").fill("카드");
        await expect(queueItems).toHaveCount(1);
        await expect(queueItems.first()).toContainText("박준호");
        await expect(page.getByText("현재 1건 표시")).toBeVisible();
        await captureScreen(page, testInfo, "consultation-queue-filter-search");

        await page
          .getByLabel("상담 큐 필터")
          .getByRole("button", { name: /내 상담/ })
          .click();
        await expect(page.getByText("검색 조건에 맞는 상담이 없습니다")).toBeVisible();
        await expect(page.getByText("현재 0건 표시")).toBeVisible();
      });
    });

    test.describe("When an operator loads history and writes an internal note", () => {
      test("Then older messages render and the note is sent over the counselor socket", async ({
        page,
      }) => {
        await page.goto("/workspaces/1/consultation");
        await page.getByText("김민지").click();

        await expect(page.getByText("generated 상담 메시지")).toBeVisible();
        await page.getByRole("button", { name: "이전 메시지 불러오기" }).click();
        await expect(page.getByText("상담 세션이 생성되었습니다.")).toBeVisible();

        await page.getByTitle("내부 메모로 남기기").click();
        await page
          .getByPlaceholder("내부 메모로 타임라인에 남길 내용을 입력하세요...")
          .fill("배송사 확인 필요 내부 메모");
        await page.getByRole("button", { name: "내부 메모 남기기" }).click();

        await expect(page.getByText("배송사 확인 필요 내부 메모")).toBeVisible();
        expect(seen).toContain("GET /consultation/sessions/601/messages?page=1&size=50");

        const frames = await page.evaluate(() => {
          const state = window as Window & { __e2eWsFrames?: string[] };
          return state.__e2eWsFrames ?? [];
        });
        expect(
          frames.some(
            (frame) =>
              frame.includes("SEND") &&
              frame.includes("/app/chat.counselor.send") &&
              frame.includes('"sessionId":601') &&
              frame.includes('"isNote":true') &&
              frame.includes("배송사 확인 필요 내부 메모"),
          ),
        ).toBe(true);
      });
    });
  });
});
