import { expect, test, type Page, type Route } from "@playwright/test";

const workspace = { id: 1, name: "QA Workspace", description: "E2E workspace" };

const pack = {
  packId: 1,
  name: "Generated API Pack",
  description: "E2E domain pack",
  versions: [{ versionId: 1, versionNo: 1, lifecycleStatus: "DRAFT", summaryJson: "{}" }],
};

const policy = {
  id: 101,
  domainPackVersionId: 1,
  policyCode: "POL_REFUND",
  name: "환불 정책",
  description: "환불 승인 조건",
  severity: "HIGH",
  conditionJson: '{"channel":"web"}',
  actionJson: '{"type":"REFUND_REVIEW"}',
  evidenceJson: "[]",
  metaJson: "{}",
  status: "ACTIVE",
  createdAt: "2026-05-22T00:00:00Z",
  updatedAt: "2026-05-22T00:00:00Z",
};

const risk = {
  id: 201,
  domainPackVersionId: 1,
  riskCode: "RISK_FRAUD",
  name: "사기 위험",
  description: "부정 거래 징후",
  riskLevel: "HIGH",
  triggerConditionJson: '{"amount":100000}',
  handlingActionJson: '{"type":"MANUAL_REVIEW"}',
  evidenceJson: "[]",
  metaJson: "{}",
  status: "ACTIVE",
  createdAt: "2026-05-22T00:00:00Z",
  updatedAt: "2026-05-22T00:00:00Z",
};

const slot = {
  id: 301,
  domainPackVersionId: 1,
  slotCode: "SLOT_ADDRESS",
  name: "배송 주소",
  description: "배송지 주소",
  dataType: "STRING",
  isSensitive: false,
  validationRuleJson: '{"required":true}',
  defaultValueJson: "{}",
  metaJson: "{}",
  status: "ACTIVE",
  createdAt: "2026-05-22T00:00:00Z",
  updatedAt: "2026-05-22T00:00:00Z",
};

const workflow = {
  id: 401,
  domainPackVersionId: 1,
  intentDefinitionId: 501,
  workflowCode: "WF_REFUND",
  name: "환불 처리",
  description: "환불 workflow",
  initialState: "START",
  terminalStatesJson: '["DONE"]',
  graphJson: null,
  evidenceJson: "{}",
  metaJson: "{}",
  createdAt: "2026-05-22T00:00:00Z",
  updatedAt: "2026-05-22T00:00:00Z",
};

const consultationSession = {
  id: 601,
  status: "ACTIVE",
  channel: "카카오톡",
  metaJson: JSON.stringify({ customerName: "김민지", handoffReason: "환불 문의" }),
  startedAt: "2026-05-22T00:00:00Z",
  assignedCounselorId: 7,
};

function encodeBase64Url(value: unknown): string {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function makeJwt(): string {
  const header = encodeBase64Url({ alg: "none", typ: "JWT" });
  const payload = encodeBase64Url({ exp: Math.floor(Date.now() / 1000) + 60 * 60 });
  return `${header}.${payload}.e2e`;
}

async function installAuth(page: Page) {
  const token = makeJwt();
  await page.addInitScript((accessToken) => {
    window.localStorage.setItem("accessToken", accessToken);
    window.localStorage.setItem("refreshToken", "e2e-refresh-token");
    window.localStorage.setItem(
      "user",
      JSON.stringify({ id: 7, email: "agent@example.com", name: "상담사", role: "OPERATOR" }),
    );
  }, token);
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installApiMocks(page: Page, seen: string[]) {
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    seen.push(`${method} ${path}${url.search}`);

    if (method === "GET" && path === "/workspaces") {
      return fulfillJson(route, { data: [workspace] });
    }

    if (method === "GET" && path === "/workspaces/1") {
      return fulfillJson(route, workspace);
    }

    if (method === "GET" && path === "/workspaces/1/domain-packs/1") {
      return fulfillJson(route, { data: pack });
    }

    if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1") {
      return fulfillJson(route, { data: { ...pack.versions[0], packId: 1, summaryJson: "{}" } });
    }

    if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/policies") {
      return fulfillJson(route, { data: [policy] });
    }

    if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/policies/101") {
      return fulfillJson(route, { data: policy });
    }

    if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/risks") {
      return fulfillJson(route, { data: [risk] });
    }

    if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/risks/201") {
      return fulfillJson(route, { data: risk });
    }

    if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/slots") {
      return fulfillJson(route, { data: [slot] });
    }

    if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/slots/301") {
      return fulfillJson(route, { data: slot });
    }

    if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/workflows") {
      return fulfillJson(route, { data: [workflow] });
    }

    if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/workflows/401") {
      return fulfillJson(route, { data: workflow });
    }

    if (
      method === "GET" &&
      path === "/workspaces/1/domain-packs/1/versions/1/workflows/401/transitions"
    ) {
      return fulfillJson(route, { data: [] });
    }

    if (method === "GET" && path === "/workspaces/1/consultation/metrics") {
      return fulfillJson(route, {
        data: {
          workspaceId: 1,
          periodStart: "2026-05-22T00:00:00Z",
          periodEnd: "2026-05-23T00:00:00Z",
          averageFirstResponseSeconds: 90,
          averageLlmFirstResponseSeconds: 3,
          averageHumanFirstResponseSeconds: 180,
          handledTodayCount: 4,
          llmHandledTodayCount: 2,
          humanHandledTodayCount: 2,
        },
      });
    }

    if (method === "GET" && path === "/workspaces/1/consultation/queue") {
      return fulfillJson(route, { data: [consultationSession] });
    }

    if (method === "GET" && path === "/consultation/sessions/601/messages") {
      return fulfillJson(route, {
        data: [
          {
            id: 701,
            seqNo: 1,
            senderRole: "CUSTOMER",
            messageType: "TEXT",
            content: "generated 상담 메시지",
            createdAt: "2026-05-22T00:01:00Z",
          },
        ],
      });
    }

    if (method === "PATCH" && path === "/consultation/sessions/601/status") {
      expect(request.postDataJSON()).toEqual({ status: "COMPLETED" });
      return fulfillJson(route, { data: { ...consultationSession, status: "COMPLETED" } });
    }

    return fulfillJson(route, { code: "E2E_UNMOCKED", message: `${method} ${path}` }, 500);
  });
}

test.beforeEach(async ({ page }) => {
  await installAuth(page);
});

test("domain pack generated read screens render list and detail flows", async ({ page }) => {
  const seen: string[] = [];
  await installApiMocks(page, seen);

  await page.goto("/workspaces/1/domain-packs/1/policies?versionId=1");
  await expect(page.getByRole("button", { name: /POL_REFUND/ })).toBeVisible();
  await page.getByRole("button", { name: /POL_REFUND/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/1\/domain-packs\/1\/policies\/101\?versionId=1/);
  await expect(page.getByText("환불 승인 조건")).toBeVisible();
  await expect(page.getByText(/REFUND_REVIEW/)).toBeVisible();

  await page.goto("/workspaces/1/domain-packs/1/risks?versionId=1");
  await page.getByRole("button", { name: /RISK_FRAUD/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/1\/domain-packs\/1\/risks\/201\?versionId=1/);
  await expect(page.getByText("부정 거래 징후")).toBeVisible();
  await expect(page.getByText(/MANUAL_REVIEW/)).toBeVisible();

  await page.goto("/workspaces/1/domain-packs/1/slots?versionId=1");
  await page.getByRole("button", { name: /SLOT_ADDRESS/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/1\/domain-packs\/1\/slots\/301\?versionId=1/);
  await expect(page.getByText("배송지 주소")).toBeVisible();
  await expect(page.getByText("NO")).toBeVisible();

  await page.goto("/workspaces/1/domain-packs/1/workflows?versionId=1");
  await expect(page.getByText("환불 처리")).toBeVisible();
  await page.getByTestId("pack-workflows-card-401-open").click();
  await expect(page).toHaveURL(/\/workspaces\/1\/domain-packs\/1\/workflows\/401\?versionId=1/);
  await expect(page.getByText("환불 workflow")).toBeVisible();
  await expect(
    page.getByText("이 워크플로우에는 아직 그래프가 정의되어 있지 않습니다."),
  ).toBeVisible();

  expect(seen).toContain("GET /workspaces/1/domain-packs/1/versions/1/policies");
  expect(seen).toContain("GET /workspaces/1/domain-packs/1/versions/1/policies/101");
  expect(seen).toContain("GET /workspaces/1/domain-packs/1/versions/1/risks");
  expect(seen).toContain("GET /workspaces/1/domain-packs/1/versions/1/risks/201");
  expect(seen).toContain("GET /workspaces/1/domain-packs/1/versions/1/slots");
  expect(seen).toContain("GET /workspaces/1/domain-packs/1/versions/1/slots/301");
  expect(seen).toContain("GET /workspaces/1/domain-packs/1/versions/1/workflows");
  expect(seen).toContain("GET /workspaces/1/domain-packs/1/versions/1/workflows/401");
});

test("consultation screen loads generated messages and completes a session", async ({ page }) => {
  const seen: string[] = [];
  await installApiMocks(page, seen);

  await page.goto("/workspaces/1/consultation");
  await expect(page.getByText("김민지")).toBeVisible();
  await page.getByText("김민지").click();

  await expect(page.getByText("generated 상담 메시지")).toBeVisible();
  await expect(page.getByText("상담 종료")).toBeEnabled();
  await page.getByText("상담 종료").click();
  await expect(page.getByText("상담이 종료되었습니다.")).toBeVisible();

  expect(seen).toContain("GET /workspaces/1/consultation/queue");
  expect(seen).toContain("GET /consultation/sessions/601/messages");
  expect(seen).toContain("PATCH /consultation/sessions/601/status");
});
