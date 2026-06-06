import { expect, test, type Page } from "@playwright/test";

import { installAuth } from "./support/generated-api-auth";
import { captureScreen, installAppApiMocks } from "./support/app-mocks";

function expectNoRequest(seen: string[], request: string) {
  expect(seen).not.toContain(request);
}

function expectRequestCount(seen: string[], request: string, expectedCount: number) {
  const calls = seen.filter((entry) => entry === request);
  expect(calls).toHaveLength(expectedCount);
}

async function expectWorkspaceBillingUrlWithoutQueries(
  page: Page,
  workspaceId: number,
  queryKeys: readonly string[],
) {
  await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}/billing$`));

  const currentUrl = new URL(page.url());
  expect(currentUrl.pathname).toBe(`/workspaces/${workspaceId}/billing`);
  expect(currentUrl.search).toBe("");

  for (const queryKey of queryKeys) {
    expect(currentUrl.searchParams.has(queryKey)).toBe(false);
  }
}

async function expectBackHistoryKeepsWorkspaceBillingWithoutQueries(
  page: Page,
  workspaceId: number,
  queryKeys: readonly string[],
) {
  const previousEntry = await page.goBack();
  expect(previousEntry).not.toBeNull();
  await expectWorkspaceBillingUrlWithoutQueries(page, workspaceId, queryKeys);
}

test.describe("Billing screens", () => {
  let seen: string[];

  test.beforeEach(async ({ page }) => {
    seen = [];
    await installAuth(page);
    await installAppApiMocks(page, seen);
  });

  test.describe("Given an active workspace subscription", () => {
    test.describe("When an operator opens billing and manages payments", () => {
      test("Then refund and cancel subscription actions require confirmation and update visible billing state", async ({
        page,
      }, testInfo) => {
        await page.goto("/workspaces/1/billing");
        const refundRequest = "POST /workspaces/1/payments/pay_7001/cancel";
        const cancelRequest = "DELETE /workspaces/1/subscription";

        await expect(page.getByRole("heading", { name: "구독", level: 1 })).toBeVisible();
        await expect(page.getByTestId("workspace-marker")).toContainText("QA Workspace");
        await expect(page.getByText("신한카드")).toBeVisible();
        await expect(page.getByText("99,000원")).toBeVisible();
        await captureScreen(page, testInfo, "billing-overview");

        await page.getByRole("button", { name: "환불" }).click();
        await expect(page.getByRole("alertdialog")).toContainText("결제를 환불할까요?");
        expectNoRequest(seen, refundRequest);
        await page.getByPlaceholder("환불 사유를 입력해주세요").fill("품질 검증 환불");
        await expect(page.getByPlaceholder("환불 사유를 입력해주세요")).toHaveValue("품질 검증 환불");
        await page.getByRole("alertdialog").getByRole("button", { name: "닫기" }).click();
        await expect(page.getByRole("alertdialog")).toBeHidden();
        expectNoRequest(seen, refundRequest);

        await page.getByRole("button", { name: "환불" }).click();
        await expect(page.getByPlaceholder("환불 사유를 입력해주세요")).toHaveValue(
          "품질 검증 환불",
        );
        await page.getByRole("alertdialog").getByRole("button", { name: "환불" }).click();
        await expect(page.getByText("환불을 요청했습니다.")).toBeVisible();
        await expect(page.getByText("취소됨")).toBeVisible();
        await expect(page.getByRole("button", { name: "환불" })).toBeHidden();

        await page.getByRole("button", { name: "구독 해지" }).click();
        await expect(page.getByRole("alertdialog")).toContainText("구독을 해지할까요?");
        expectNoRequest(seen, cancelRequest);
        await page.getByRole("alertdialog").getByRole("button", { name: "구독 해지" }).click();
        await expect(page.getByText("구독을 해지했습니다.")).toBeVisible();
        await expect(page.getByText("해지됨")).toBeVisible();
        await expect(page.getByText(/현재 주기 종료일/)).toBeVisible();
        await expect(page.getByRole("button", { name: "구독 해지" })).toBeHidden();

        expect(seen).toContain(refundRequest);
        expect(seen).toContain(cancelRequest);

        await page.getByTestId("workspace-marker").click();
        await page.getByTestId("workspace-option-2").click();
        await expect(page).toHaveURL(/\/workspaces\/2\/workflows$/);
        await page.goto("/workspaces/2/billing");
        await expect(page.getByTestId("workspace-marker")).toContainText("Ops Workspace");
        await expect(page.getByText("국민카드")).toBeVisible();
        await expect(page.getByText("49,000원")).toBeVisible();
        await expect(page.getByText("구독 중")).toBeVisible();
        await expect(page.getByText("해지됨")).toBeHidden();
        await expect(page.getByText("취소됨")).toBeHidden();
        expect(seen).toContain("GET /workspaces/2/billing/overview");
      });
    });
  });

  test.describe("Given a Toss billing redirect succeeds", () => {
    test.describe("When the success landing page receives auth parameters", () => {
      test("Then it confirms billing authorization and returns to billing", async ({ page }) => {
        const sensitiveQueryKeys = ["authKey", "customerKey"] as const;

        await page.goto("/workspaces/1/billing");
        await expect(page.getByRole("heading", { name: "구독", level: 1 })).toBeVisible();

        await page.goto(
          "/billing/success?workspaceId=1&flow=billing&authKey=auth-e2e&customerKey=customer-qa-workspace",
        );

        await expectWorkspaceBillingUrlWithoutQueries(page, 1, sensitiveQueryKeys);
        await expect(page.getByRole("heading", { name: "구독", level: 1 })).toBeVisible();
        expectRequestCount(seen, "POST /workspaces/1/billing/authorizations", 1);
        await expectBackHistoryKeepsWorkspaceBillingWithoutQueries(
          page,
          1,
          sensitiveQueryKeys,
        );
        expectRequestCount(seen, "POST /workspaces/1/billing/authorizations", 1);
      });
    });
  });

  test.describe("Given a Toss widget payment succeeds", () => {
    test.describe("When the success landing page receives payment parameters", () => {
      test("Then it confirms the one-off payment and returns to billing", async ({ page }) => {
        const sensitiveQueryKeys = ["paymentKey", "orderId", "amount"] as const;

        await page.goto("/workspaces/1/billing");
        await expect(page.getByRole("heading", { name: "구독", level: 1 })).toBeVisible();

        await page.goto(
          "/billing/success?workspaceId=1&flow=widget&paymentKey=payment-e2e&orderId=order-e2e&amount=99000",
        );

        await expectWorkspaceBillingUrlWithoutQueries(page, 1, sensitiveQueryKeys);
        await expect(page.getByRole("heading", { name: "구독", level: 1 })).toBeVisible();
        expectRequestCount(seen, "POST /workspaces/1/payments/confirm", 1);
        await expectBackHistoryKeepsWorkspaceBillingWithoutQueries(
          page,
          1,
          sensitiveQueryKeys,
        );
        expectRequestCount(seen, "POST /workspaces/1/payments/confirm", 1);
      });

      test("Then a repeated orderId does not confirm the payment again", async ({ page }) => {
        const successUrl =
          "/billing/success?workspaceId=1&flow=widget&paymentKey=payment-e2e&orderId=order-e2e&amount=99000";

        await page.goto(successUrl);
        await expect(page).toHaveURL(/\/workspaces\/1\/billing/);

        const confirmCallsAfterFirstEntry = seen.filter(
          (entry) => entry === "POST /workspaces/1/payments/confirm",
        );
        expect(confirmCallsAfterFirstEntry).toHaveLength(1);

        await page.goto(successUrl);

        await expect(page).toHaveURL(/\/workspaces\/1\/billing/);
        await expect(page.getByRole("heading", { name: "구독", level: 1 })).toBeVisible();
        await expect(page.getByText("이미 처리된 결제입니다.")).toBeVisible();
        expect(page.url()).not.toContain("paymentKey=");
        expect(page.url()).not.toContain("orderId=");
        expect(page.url()).not.toContain("amount=");

        const confirmCallsAfterSecondEntry = seen.filter(
          (entry) => entry === "POST /workspaces/1/payments/confirm",
        );
        expect(confirmCallsAfterSecondEntry).toHaveLength(1);
      });
    });
  });

  test.describe("Given a payment redirect fails", () => {
    test.describe("When the operator retries from the fail landing page", () => {
      test("Then they are sent back to workspace billing", async ({ page }) => {
        await page.goto(
          "/billing/fail?workspaceId=1&code=CARD_DECLINED&message=%EC%B9%B4%EB%93%9C%EA%B0%80%20%EA%B1%B0%EC%A0%88%EB%90%90%EC%8A%B5%EB%8B%88%EB%8B%A4",
        );

        await expect(page.getByText("카드가 거절됐습니다")).toBeVisible();
        await expect(page.getByText("오류 코드: CARD_DECLINED")).toBeVisible();
        await page.getByRole("button", { name: "다시 시도" }).click();
        await expect(page).toHaveURL(/\/workspaces\/1\/billing/);
      });

      test("Then a missing workspace id falls back to the workspace entry point", async ({
        page,
      }) => {
        await page.goto(
          "/billing/fail?code=USER_CANCEL&message=%EA%B2%B0%EC%A0%9C%EA%B0%80%20%EC%B7%A8%EC%86%8C%EB%90%90%EC%8A%B5%EB%8B%88%EB%8B%A4",
        );

        await expect(page.getByText("결제가 취소됐습니다")).toBeVisible();
        await expect(page.getByText("오류 코드: USER_CANCEL")).toBeVisible();
        await page.getByRole("button", { name: "다시 시도" }).click();
        await expect(page).toHaveURL(/\/workspaces\/1\/dashboard/);
        await expect(page.getByRole("heading", { name: "대시보드", exact: true })).toBeVisible();
      });
    });
  });
});
