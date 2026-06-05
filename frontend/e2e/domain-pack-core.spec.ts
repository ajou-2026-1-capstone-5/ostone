import { expect, test } from "@playwright/test";

import { installAuth } from "./support/generated-api-auth";
import { captureScreen, installAppApiMocks } from "./support/app-mocks";

test.describe("Domain pack core read flows", () => {
  let seen: string[];

  test.beforeEach(async ({ page }) => {
    seen = [];
    await installAuth(page);
    await installAppApiMocks(page, seen);
  });

  test.describe("Given generated domain packs in a workspace", () => {
    test.describe("When an operator filters the domain pack list", () => {
      test("Then operating and idle sections stay navigable", async ({ page }, testInfo) => {
        await page.goto("/workspaces/1/domain-packs");
        await expect(page.getByRole("heading", { name: "도메인팩 관리" })).toBeVisible();
        await expect(page.getByText("Generated API Pack")).toBeVisible();

        await page.getByRole("button", { name: "비운영 1" }).click();
        await expect(page.getByText("검토 대기 팩")).toBeVisible();
        await expect(page.getByText("Generated API Pack")).toBeHidden();

        await page.getByRole("button", { name: "전체 2" }).click();
        await expect(page.getByText("Generated API Pack")).toBeVisible();
        await captureScreen(page, testInfo, "domain-pack-list");

        await page.getByRole("link", { name: /Generated API Pack/ }).click();
        await expect(page).toHaveURL(/\/workspaces\/1\/domain-packs\/1\?versionId=1/);
      });
    });

    test.describe("When they open the pack summary", () => {
      test("Then summary metrics and component drill-down links are visible", async ({
        page,
      }, testInfo) => {
        await page.goto("/workspaces/1/domain-packs/1");

        await expect(page.getByText("도메인팩 정보")).toBeVisible();
        await expect(page.getByText("환불 자동화 팩")).toBeVisible();
        await expect(page.getByText("매핑률")).toBeVisible();
        await expect(page.getByRole("button", { name: "확인 항목 상세 보기" })).toBeVisible();
        await captureScreen(page, testInfo, "domain-pack-summary");

        await page.getByRole("button", { name: "확인 항목 상세 보기" }).click();
        await expect(page).toHaveURL(/\/workspaces\/1\/domain-packs\/1\/slots\?versionId=1/);
        await expect(seen).toContain("GET /workspaces/1/domain-packs/1/versions/1/slots");
      });
    });

    test.describe("When they open legacy version URLs", () => {
      test("Then saved version links redirect to the current domain pack routes", async ({
        page,
      }) => {
        await page.goto("/workspaces/1/domain-packs/1/versions/1");

        await expect(page).toHaveURL(/\/workspaces\/1\/domain-packs\/1\?versionId=1/);
        await expect(page.getByText("도메인팩 정보")).toBeVisible();

        await page.goto("/workspaces/1/domain-packs/1/versions/1/workflows/401?source=legacy");

        await expect(page).toHaveURL(
          /\/workspaces\/1\/domain-packs\/1\/workflows\/401\?source=legacy&versionId=1/,
        );
        await expect(page.getByText("환불 처리")).toBeVisible();
        await expect(page.getByText("주문번호를 확인하고 환불 정책에 따라 안내")).toBeVisible();
      });
    });

    test.describe("When they deploy an operating candidate version", () => {
      test("Then the deploy confirmation calls the version deploy endpoint", async ({ page }) => {
        await page.goto("/workspaces/1/domain-packs/1?versionId=2");

        await expect(
          page.getByRole("button", {
            name: /v2[\s\S]*상담사 연결 조건을 보강한 운영 가능 버전/,
          }),
        ).toBeVisible();
        await expect(page.getByText("상담사 연결 정책")).toBeVisible();
        await expect(page.getByText("상담사 연결 검토 워크플로우")).toBeVisible();
        await page.getByRole("button", { name: "배포", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toContainText("v2 버전을 배포할까요?");
        await page.getByRole("button", { name: "배포하기" }).click();

        await expect(page.getByText("도메인팩 버전이 배포되었습니다.")).toBeVisible();
        expect(seen).toContain("POST /workspaces/1/domain-packs/1/versions/2/deploy");
      });
    });

    test.describe("When they apply and discard a draft version", () => {
      test("Then the draft action dialogs send the selected version operations", async ({
        page,
      }, testInfo) => {
        await page.goto("/workspaces/1/domain-packs/1?versionId=3");

        await expect(
          page.getByRole("button", {
            name: /v3[\s\S]*검토 중[\s\S]*고액 환불 검토 흐름을 정리한 수정 검토본/,
          }),
        ).toBeVisible();
        await expect(page.getByText("고액 환불 정책")).toBeVisible();
        await expect(page.getByText("고액 환불 검토 워크플로우")).toBeVisible();
        await captureScreen(page, testInfo, "domain-pack-draft-actions");

        await page.getByRole("button", { name: "적용", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toContainText(
          "검토 중인 v3 수정버전을 적용할까요?",
        );
        await page.getByLabel("변경사항 정리").fill("검토본 적용 메모");
        await page.getByRole("button", { name: "적용하기" }).click();
        await expect(page.getByText("초안 수정버전이 적용되었습니다.")).toBeVisible();
        expect(seen).toContain("POST /workspaces/1/domain-packs/1/versions/3/activate");

        await page.goto("/workspaces/1/domain-packs/1?versionId=3");
        await page.getByRole("button", { name: "삭제", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toContainText(
          "검토 중인 v3 버전을 삭제할까요?",
        );
        await page.getByRole("button", { name: "삭제하기" }).click();

        await expect(page.getByText("검토 중인 버전이 삭제되었습니다.")).toBeVisible();
        await expect(page).toHaveURL(/\/workspaces\/1\/domain-packs\/1\?versionId=1/);
        expect(seen).toContain("DELETE /workspaces/1/domain-packs/1/versions/3/draft");
      });
    });

    test.describe("When they inspect an intent", () => {
      test("Then intent evidence and matched workflow context render", async ({ page }) => {
        await page.goto("/workspaces/1/domain-packs/1/intents?versionId=1");
        await page.getByRole("button", { name: /INT_REFUND/ }).click();

        await expect(page).toHaveURL(
          /\/workspaces\/1\/domain-packs\/1\/intents\/501\?versionId=1/,
        );
        await expect(
          page.getByLabel("상담 유형 상세").getByText("고객이 결제 취소나 환불 가능 여부"),
        ).toBeVisible();
        await expect(page.getByRole("heading", { name: "관련 키워드" })).toBeVisible();
        await expect(page.getByText("#12")).toBeVisible();
        await expect(page.getByText("36건")).toBeVisible();
        await expect(page.getByText("취소", { exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: "대표 문장" })).toBeVisible();
        await expect(page.getByText("결제한 상품을 환불하고 싶어요.")).toBeVisible();
        await expect(page.getByText("환불 처리")).toBeVisible();
        expect(seen).toContain("GET /workspaces/1/domain-packs/1/versions/1/intents/501");
      });
    });

    test.describe("When they edit a policy from the detail panel", () => {
      test("Then invalid JSON is blocked before the policy update request", async ({ page }) => {
        await page.goto("/workspaces/1/domain-packs/1/policies?versionId=1");
        await page.getByRole("button", { name: /POL_REFUND/ }).click();
        await expect(page.getByLabel("응대 기준 상세")).toContainText("환불 정책");

        await page.getByRole("button", { name: /POL_REFUND 응대 기준 수정/ }).click();
        await expect(page.getByLabel("응대 기준 수정")).toBeVisible();

        await page.getByLabel("조건 JSON").fill("[]");
        await page.getByRole("button", { name: "저장" }).click();
        await expect(page.getByText("적용 조건 JSON은 객체여야 합니다.")).toBeVisible();
        expect(
          seen.some(
            (entry) => entry === "PATCH /workspaces/1/domain-packs/1/versions/1/policies/101",
          ),
        ).toBe(false);
      });

      test("Then a valid save updates the policy detail", async ({ page }, testInfo) => {
        await page.goto("/workspaces/1/domain-packs/1/policies?versionId=1");
        await page.getByRole("button", { name: /POL_REFUND/ }).click();

        await page.getByRole("button", { name: /POL_REFUND 응대 기준 수정/ }).click();
        await expect(page.getByLabel("응대 기준 수정")).toBeVisible();
        await captureScreen(page, testInfo, "policy-edit-panel");

        await page.getByLabel("이름 *").fill("고액 환불 정책");
        await page.getByLabel("설명").fill("고액 환불은 검토 후 안내합니다.");
        await page
          .getByLabel("조건 JSON")
          .fill(JSON.stringify({ amount: { gte: 100000 } }, null, 2));
        await page
          .getByLabel("액션 JSON")
          .fill(JSON.stringify({ type: "MANUAL_REVIEW" }, null, 2));
        await page
          .getByLabel("근거 JSON")
          .fill(JSON.stringify([{ segmentId: "seg-99" }], null, 2));
        await page.getByLabel("메타 JSON").fill(JSON.stringify({ source: "e2e" }, null, 2));
        const updateRequest = page.waitForRequest(
          (request) =>
            request.method() === "PATCH" &&
            request.url().includes("/workspaces/1/domain-packs/1/versions/1/policies/101"),
        );
        await page.getByRole("button", { name: "저장" }).click();
        const requestBody = (await updateRequest).postDataJSON();

        expect(requestBody).toEqual(
          expect.objectContaining({
            name: "고액 환불 정책",
            description: "고액 환불은 검토 후 안내합니다.",
            conditionJson: JSON.stringify({ amount: { gte: 100000 } }, null, 2),
            actionJson: JSON.stringify({ type: "MANUAL_REVIEW" }, null, 2),
            evidenceJson: JSON.stringify([{ segmentId: "seg-99" }], null, 2),
            metaJson: JSON.stringify({ source: "e2e" }, null, 2),
          }),
        );

        await expect(page.getByText("응대 기준이 수정되었습니다.")).toBeVisible();
        await expect(page.getByLabel("응대 기준 상세")).toContainText("고액 환불 정책");
        expect(seen).toContain("PATCH /workspaces/1/domain-packs/1/versions/1/policies/101");
      });

      test("Then the status switch updates request body and detail state", async ({ page }) => {
        await page.goto("/workspaces/1/domain-packs/1/policies?versionId=1");
        await page.getByRole("button", { name: /POL_REFUND/ }).click();

        await page.getByRole("button", { name: /POL_REFUND 응대 기준 수정/ }).click();
        const statusSwitch = page.getByRole("switch", { name: "응대 기준 상태" });
        await expect(statusSwitch).toBeChecked();

        const statusRequest = page.waitForRequest(
          (request) =>
            request.method() === "PATCH" &&
            request
              .url()
              .includes("/workspaces/1/domain-packs/1/versions/1/policies/101/status"),
        );
        await statusSwitch.click();
        const requestBody = (await statusRequest).postDataJSON();

        expect(requestBody).toEqual({ status: "INACTIVE" });
        await expect(statusSwitch).not.toBeChecked();
        await page.getByRole("button", { name: "취소" }).click();
        await expect(page.getByLabel("응대 기준 상세")).toContainText("사용 안 함");
        expect(seen).toContain(
          "PATCH /workspaces/1/domain-packs/1/versions/1/policies/101/status",
        );
      });
    });

    test.describe("When they edit a risk from the detail panel", () => {
      test("Then invalid JSON is blocked before the risk update request", async ({ page }) => {
        await page.goto("/workspaces/1/domain-packs/1/risks?versionId=1");
        await page.getByRole("button", { name: /RISK_FRAUD/ }).click();
        await expect(page.getByLabel("주의 사항 상세")).toContainText("부정 환불 위험");

        await page.getByRole("button", { name: /RISK_FRAUD 주의 사항 수정/ }).click();
        await expect(page.getByLabel("주의 사항 수정")).toBeVisible();

        await page.getByLabel("트리거 조건 JSON").fill("[]");
        await page.getByRole("button", { name: "저장" }).click();
        await expect(page.getByText("감지 조건 JSON은 객체여야 합니다.")).toBeVisible();
        expect(
          seen.some(
            (entry) => entry === "PATCH /workspaces/1/domain-packs/1/versions/1/risks/201",
          ),
        ).toBe(false);
      });

      test("Then a valid save updates the risk detail", async ({ page }, testInfo) => {
        await page.goto("/workspaces/1/domain-packs/1/risks?versionId=1");
        await page.getByRole("button", { name: /RISK_FRAUD/ }).click();

        await page.getByRole("button", { name: /RISK_FRAUD 주의 사항 수정/ }).click();
        await expect(page.getByLabel("주의 사항 수정")).toBeVisible();
        await captureScreen(page, testInfo, "risk-edit-panel");

        await page.getByLabel("이름 *").fill("고액 환불 위험");
        await page.getByLabel("설명").fill("고액 환불은 상담사 검토로 전환합니다.");
        await page
          .getByLabel("트리거 조건 JSON")
          .fill(JSON.stringify({ amount: { gte: 100000 } }, null, 2));
        await page
          .getByLabel("처리 액션 JSON")
          .fill(JSON.stringify({ type: "MANUAL_REVIEW" }, null, 2));
        await page
          .getByLabel("근거 JSON")
          .fill(JSON.stringify([{ segmentId: "risk-seg-99" }], null, 2));
        await page.getByLabel("메타 JSON").fill(JSON.stringify({ source: "e2e" }, null, 2));
        const updateRequest = page.waitForRequest(
          (request) =>
            request.method() === "PATCH" &&
            request.url().includes("/workspaces/1/domain-packs/1/versions/1/risks/201"),
        );
        await page.getByRole("button", { name: "저장" }).click();
        const requestBody = (await updateRequest).postDataJSON();

        expect(requestBody).toEqual(
          expect.objectContaining({
            name: "고액 환불 위험",
            description: "고액 환불은 상담사 검토로 전환합니다.",
            triggerConditionJson: JSON.stringify({ amount: { gte: 100000 } }, null, 2),
            handlingActionJson: JSON.stringify({ type: "MANUAL_REVIEW" }, null, 2),
            evidenceJson: JSON.stringify([{ segmentId: "risk-seg-99" }], null, 2),
            metaJson: JSON.stringify({ source: "e2e" }, null, 2),
          }),
        );

        await expect(page.getByText("주의 사항이 수정되었습니다.")).toBeVisible();
        await expect(page.getByLabel("주의 사항 상세")).toContainText("고액 환불 위험");
        expect(seen).toContain("PATCH /workspaces/1/domain-packs/1/versions/1/risks/201");
      });

      test("Then the status switch updates request body and detail state", async ({ page }) => {
        await page.goto("/workspaces/1/domain-packs/1/risks?versionId=1");
        await page.getByRole("button", { name: /RISK_FRAUD/ }).click();

        await page.getByRole("button", { name: /RISK_FRAUD 주의 사항 수정/ }).click();
        const statusSwitch = page.getByRole("switch", { name: "주의 사항 상태" });
        await expect(statusSwitch).toBeChecked();

        const statusRequest = page.waitForRequest(
          (request) =>
            request.method() === "PATCH" &&
            request.url().includes("/workspaces/1/domain-packs/1/versions/1/risks/201/status"),
        );
        await statusSwitch.click();
        const requestBody = (await statusRequest).postDataJSON();

        expect(requestBody).toEqual({ status: "INACTIVE" });
        await expect(statusSwitch).not.toBeChecked();
        await page.getByRole("button", { name: "취소" }).click();
        await expect(page.getByLabel("주의 사항 상세")).toContainText("사용 안 함");
        expect(seen).toContain(
          "PATCH /workspaces/1/domain-packs/1/versions/1/risks/201/status",
        );
      });
    });

    test.describe("When they open the workflow graph", () => {
      test("Then the graph view renders the generated state labels", async ({ page }, testInfo) => {
        await page.goto("/workspaces/1/domain-packs/1/workflows/401/graph?versionId=1");

        await expect(page.getByText("환불 처리")).toBeVisible();
        await expect(page.getByText("문의 접수")).toBeVisible();
        await expect(page.getByText("환불 조건 확인")).toBeVisible();
        await expect(page.getByText("환불 안내 완료")).toBeVisible();
        await captureScreen(page, testInfo, "workflow-graph");
        expect(seen).toContain("GET /workspaces/1/domain-packs/1/versions/1/workflows/401");
      });
    });
  });
});
