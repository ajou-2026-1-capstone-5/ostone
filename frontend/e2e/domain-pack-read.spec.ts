import { expect, test } from "@playwright/test";

import { installAuth } from "./support/generated-api-auth";
import { installDomainPackApiMocks } from "./support/generated-api-mocks";

test.describe("Domain pack generated read screens", () => {
  let seen: string[];

  test.beforeEach(async ({ page }) => {
    seen = [];
    await installAuth(page);
    await installDomainPackApiMocks(page, seen);
  });

  test.describe("Given a generated API-backed domain pack version", () => {
    test.describe("When an operator opens a draft sub-component screen", () => {
      test("Then a version safety banner shows the lifecycle, impact counts, and a blocked-state reason", async ({
        page,
      }) => {
        await page.goto("/workspaces/1/domain-packs/1/policies?versionId=1");

        const banner = page.getByLabel("버전 안전성 정보");
        await expect(banner).toBeVisible();
        await expect(banner.getByText("검토 중", { exact: true })).toBeVisible();
        await expect(banner.getByText("검토본", { exact: true })).toBeVisible();
        await expect(banner.getByText("반영 대상 구성요소")).toBeVisible();
        await expect(banner.getByRole("status")).toContainText(
          "적용하면 변경 내용이 도메인팩에 반영",
        );
        expect(seen).toContain("GET /workspaces/1/domain-packs/1/versions/1");
      });
    });

    test.describe("When an operator opens the policy list screen", () => {
      test("Then the policy detail screen renders generated list and detail data", async ({
        page,
      }) => {
        await page.goto("/workspaces/1/domain-packs/1/policies?versionId=1");
        await expect(page.getByRole("button", { name: /POL_REFUND/ })).toBeVisible();

        await page.getByRole("button", { name: /POL_REFUND/ }).click();

        await expect(page).toHaveURL(
          /\/workspaces\/1\/domain-packs\/1\/policies\/101\?versionId=1/,
        );
        await expect(page.getByText("환불 승인 조건")).toBeVisible();
        await expect(page.getByText(/REFUND_REVIEW/)).toBeVisible();
        expect(seen).toContain("GET /workspaces/1/domain-packs/1/versions/1/policies");
        expect(seen).toContain("GET /workspaces/1/domain-packs/1/versions/1/policies/101");
      });
    });

    test.describe("When an operator opens the risk list screen", () => {
      test("Then the risk detail screen renders generated list and detail data", async ({
        page,
      }) => {
        await page.goto("/workspaces/1/domain-packs/1/risks?versionId=1");

        await page.getByRole("button", { name: /RISK_FRAUD/ }).click();

        await expect(page).toHaveURL(/\/workspaces\/1\/domain-packs\/1\/risks\/201\?versionId=1/);
        await expect(page.getByText("부정 거래 징후")).toBeVisible();
        await expect(page.getByText(/MANUAL_REVIEW/)).toBeVisible();
        expect(seen).toContain("GET /workspaces/1/domain-packs/1/versions/1/risks");
        expect(seen).toContain("GET /workspaces/1/domain-packs/1/versions/1/risks/201");
      });
    });

    test.describe("When an operator opens the slot list screen", () => {
      test("Then the slot detail screen renders generated list and detail data", async ({
        page,
      }) => {
        await page.goto("/workspaces/1/domain-packs/1/slots?versionId=1");

        await page.getByRole("button", { name: /SLOT_ADDRESS/ }).click();

        await expect(page).toHaveURL(/\/workspaces\/1\/domain-packs\/1\/slots\/301\?versionId=1/);
        await expect(page.getByText("배송지 주소")).toBeVisible();
        await expect(page.getByText("아니오")).toBeVisible();
        expect(seen).toContain("GET /workspaces/1/domain-packs/1/versions/1/slots");
        expect(seen).toContain("GET /workspaces/1/domain-packs/1/versions/1/slots/301");
      });
    });

    test.describe("When an operator opens the workflow list screen", () => {
      test("Then the workflow detail screen renders generated list and detail data", async ({
        page,
      }) => {
        await page.goto("/workspaces/1/domain-packs/1/workflows?versionId=1");
        await expect(page.getByText("환불 처리")).toBeVisible();

        await page.getByTestId("pack-workflows-card-401-open").click();

        await expect(page).toHaveURL(
          /\/workspaces\/1\/domain-packs\/1\/workflows\/401\?versionId=1/,
        );
        await expect(page.getByText("환불 workflow")).toBeVisible();
        await expect(
          page.getByText("이 워크플로우에는 아직 흐름도가 정의되어 있지 않습니다."),
        ).toBeVisible();
        expect(seen).toContain("GET /workspaces/1/domain-packs/1/versions/1/workflows");
        expect(seen).toContain("GET /workspaces/1/domain-packs/1/versions/1/workflows/401");
      });
    });
  });
});
