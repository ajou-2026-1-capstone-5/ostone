import { expect, test } from "@playwright/test";

import { installAuth } from "./support/generated-api-auth";
import { captureScreen, installAppApiMocks } from "./support/app-mocks";

test.describe("Billing screens", () => {
  let seen: string[];

  test.beforeEach(async ({ page }) => {
    seen = [];
    await installAuth(page);
    await installAppApiMocks(page, seen);
  });

  test.describe("Given an active workspace subscription", () => {
    test.describe("When an operator opens billing and manages payments", () => {
      test("Then refund and cancel subscription actions call the correct endpoints", async ({
        page,
      }, testInfo) => {
        await page.goto("/workspaces/1/billing");
        await expect(page.getByRole("heading", { name: "구독", level: 1 })).toBeVisible();
        await expect(page.getByText("신한카드")).toBeVisible();
        await expect(page.getByText("99,000원")).toBeVisible();
        await captureScreen(page, testInfo, "billing-overview");

        await page.getByRole("button", { name: "환불" }).click();
        await expect(page.getByRole("alertdialog")).toContainText("결제를 환불할까요?");
        await page.getByPlaceholder("환불 사유를 입력해주세요").fill("품질 검증 환불");
        await page.getByRole("alertdialog").getByRole("button", { name: "환불" }).click();
        await expect(page.getByText("환불을 요청했습니다.")).toBeVisible();

        await page.getByRole("button", { name: "구독 해지" }).click();
        await expect(page.getByRole("alertdialog")).toContainText("구독을 해지할까요?");
        await page.getByRole("alertdialog").getByRole("button", { name: "구독 해지" }).click();
        await expect(page.getByText("구독을 해지했습니다.")).toBeVisible();

        expect(seen).toContain("POST /workspaces/1/payments/pay_7001/cancel");
        expect(seen).toContain("DELETE /workspaces/1/subscription");
      });
    });
  });

  test.describe("Given a Toss billing redirect succeeds", () => {
    test.describe("When the success landing page receives auth parameters", () => {
      test("Then it confirms billing authorization and returns to billing", async ({ page }) => {
        await page.goto(
          "/billing/success?workspaceId=1&flow=billing&authKey=auth-e2e&customerKey=customer-qa-workspace",
        );

        await expect(page).toHaveURL(/\/workspaces\/1\/billing/);
        await expect(page.getByRole("heading", { name: "구독", level: 1 })).toBeVisible();
        expect(seen).toContain("POST /workspaces/1/billing/authorizations");
      });
    });
  });

  test.describe("Given a Toss widget payment succeeds", () => {
    test.describe("When the success landing page receives payment parameters", () => {
      test("Then it confirms the one-off payment and returns to billing", async ({ page }) => {
        await page.goto(
          "/billing/success?workspaceId=1&flow=widget&paymentKey=payment-e2e&orderId=order-e2e&amount=99000",
        );

        await expect(page).toHaveURL(/\/workspaces\/1\/billing/);
        await expect(page.getByRole("heading", { name: "구독", level: 1 })).toBeVisible();
        expect(seen).toContain("POST /workspaces/1/payments/confirm");
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
