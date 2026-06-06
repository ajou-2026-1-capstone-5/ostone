import { expect, type Page, type Route } from "@playwright/test";

import {
  consultationSession,
  pack,
  policy,
  risk,
  slot,
  workflow,
  workspace,
} from "./generated-api-test-data";

const queueSessions = [
  {
    ...consultationSession,
    metaJson: JSON.stringify({
      customerName: "김민지",
      title: "환불 요청",
      handoffReason: "환불 문의",
      handoffRequired: true,
      handoffAt: "2026-05-22T00:00:00Z",
      lastMessagePreview: "주문 취소 후 환불이 아직 안 됐어요.",
      lastMessageRole: "CUSTOMER",
      lastMessageAt: "2026-05-22T00:05:00Z",
    }),
  },
  {
    id: 602,
    status: "ACTIVE",
    channel: "웹채팅",
    metaJson: JSON.stringify({
      customerName: "박준호",
      title: "카드 결제 취소",
      handoffReason: "카드 결제 취소 요청",
      handoffRequired: true,
      handoffAt: "2026-05-22T00:03:00Z",
      lastMessagePreview: "카드 승인 취소가 가능한지 확인해주세요.",
      lastMessageRole: "CUSTOMER",
      lastMessageAt: "2026-05-22T00:08:00Z",
    }),
    startedAt: "2026-05-22T00:03:00Z",
    assignedCounselorId: null,
  },
  {
    id: 603,
    status: "ACTIVE",
    channel: "카카오톡",
    metaJson: JSON.stringify({
      customerName: "이서연",
      title: "배송지 변경",
      handoffReason: "배송지 변경 문의",
      handoffRequired: false,
      lastMessagePreview: "배송 주소를 다른 곳으로 바꾸고 싶어요.",
      lastMessageRole: "CUSTOMER",
      lastMessageAt: "2026-05-22T00:11:00Z",
    }),
    startedAt: "2026-05-22T00:07:00Z",
    assignedCounselorId: null,
  },
  {
    id: 604,
    status: "ACTIVE",
    channel: "이메일",
    metaJson: JSON.stringify({
      customerName: "최하늘",
      title: "포인트 적립",
      handoffReason: "포인트 적립 문의",
      handoffRequired: false,
      lastMessagePreview: "방금 결제했는데 포인트가 보이지 않아요.",
      lastMessageRole: "CUSTOMER",
      lastMessageAt: "2026-05-22T00:20:00Z",
    }),
    startedAt: "2026-05-22T00:18:00Z",
    assignedCounselorId: 99,
  },
];

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function trackRequest(
  page: Page,
  seen: string[],
  handler: (route: Route, method: string, path: string) => Promise<boolean>,
) {
  return page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    seen.push(`${method} ${path}${url.search}`);

    if (await handler(route, method, path)) {
      return;
    }

    return fulfillJson(route, { code: "E2E_UNMOCKED", message: `${method} ${path}` }, 500);
  });
}

async function fulfillWorkspaceShell(route: Route, method: string, path: string): Promise<boolean> {
  if (method === "GET" && path === "/workspaces") {
    await fulfillJson(route, { data: [workspace] });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1") {
    await fulfillJson(route, workspace);
    return true;
  }

  return false;
}

async function fulfillDomainPackShell(
  route: Route,
  method: string,
  path: string,
): Promise<boolean> {
  if (method === "GET" && path === "/workspaces/1/domain-packs/1") {
    await fulfillJson(route, { data: pack });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1") {
    await fulfillJson(route, {
      data: {
        ...pack.versions[0],
        packId: 1,
        summaryJson: "{}",
        intentCount: 3,
        slotCount: 2,
        policyCount: 1,
        riskCount: 1,
        workflowCount: 2,
      },
    });
    return true;
  }

  return false;
}

export async function installDomainPackApiMocks(page: Page, seen: string[]) {
  await trackRequest(page, seen, async (route, method, path) => {
    if (await fulfillWorkspaceShell(route, method, path)) {
      return true;
    }

    if (await fulfillDomainPackShell(route, method, path)) {
      return true;
    }

    if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/policies") {
      await fulfillJson(route, { data: [policy] });
      return true;
    }

    if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/policies/101") {
      await fulfillJson(route, { data: policy });
      return true;
    }

    if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/risks") {
      await fulfillJson(route, { data: [risk] });
      return true;
    }

    if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/risks/201") {
      await fulfillJson(route, { data: risk });
      return true;
    }

    if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/slots") {
      await fulfillJson(route, { data: [slot] });
      return true;
    }

    if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/slots/301") {
      await fulfillJson(route, { data: slot });
      return true;
    }

    if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/workflows") {
      await fulfillJson(route, { data: [workflow] });
      return true;
    }

    if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/workflows/401") {
      await fulfillJson(route, { data: workflow });
      return true;
    }

    if (
      method === "GET" &&
      path === "/workspaces/1/domain-packs/1/versions/1/workflows/401/transitions"
    ) {
      await fulfillJson(route, { data: [] });
      return true;
    }

    return false;
  });
}

export async function installConsultationApiMocks(page: Page, seen: string[]) {
  await trackRequest(page, seen, async (route, method, path) => {
    if (await fulfillWorkspaceShell(route, method, path)) {
      return true;
    }

    if (await fulfillDomainPackShell(route, method, path)) {
      return true;
    }

    if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/workflows") {
      await fulfillJson(route, { data: [workflow] });
      return true;
    }

    if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/workflows/401") {
      await fulfillJson(route, { data: workflow });
      return true;
    }

    if (
      method === "GET" &&
      path === "/workspaces/1/domain-packs/1/versions/1/workflows/401/transitions"
    ) {
      await fulfillJson(route, { data: [] });
      return true;
    }

    if (method === "GET" && path === "/workspaces/1/consultation/metrics") {
      await fulfillJson(route, {
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
      return true;
    }

    if (method === "GET" && path === "/workspaces/1/consultation/queue") {
      await fulfillJson(route, { data: queueSessions });
      return true;
    }

    if (method === "GET" && path === "/consultation/sessions/601/messages") {
      const url = new URL(route.request().url());
      const page = url.searchParams.get("page") ?? "0";
      if (page === "1") {
        await fulfillJson(route, {
          data: {
            content: [
              {
                id: 700,
                seqNo: 0,
                senderRole: "SYSTEM",
                messageType: "TEXT",
                content: "상담 세션이 생성되었습니다.",
                createdAt: "2026-05-22T00:00:10Z",
              },
            ],
            page: 1,
            size: 50,
            totalElements: 2,
            totalPages: 2,
          },
        });
        return true;
      }

      await fulfillJson(route, {
        data: {
          content: [
            {
              id: 701,
              seqNo: 1,
              senderRole: "CUSTOMER",
              messageType: "TEXT",
              content: "generated 상담 메시지",
              createdAt: "2026-05-22T00:01:00Z",
            },
          ],
          page: 0,
          size: 50,
          totalElements: 2,
          totalPages: 2,
        },
      });
      return true;
    }

    if (method === "GET" && path === "/consultation/sessions/601/matched-workflow") {
      await fulfillJson(route, {
        sessionId: 601,
        workspaceId: 1,
        domainPackId: 1,
        domainPackVersionId: 1,
        executionId: 7001,
        executionStatus: "RUNNING",
        currentState: "환불 조건 확인",
        workflowDefinitionId: 401,
        workflowCode: "WF_REFUND",
        workflowName: "환불 처리",
        workflowDescription: "주문번호를 확인하고 환불 정책에 따라 안내합니다.",
        graphJson: null,
        initialState: "START",
        terminalStates: ["DONE"],
        intentCode: "INT_REFUND",
        intentName: "환불 문의",
      });
      return true;
    }

    if (method === "PATCH" && path === "/consultation/sessions/601/status") {
      expect(route.request().postDataJSON()).toEqual({
        status: "RESOLVED",
        resolutionOutcome: "FOLLOW_UP_REQUIRED",
        resolutionReason: "배송사 확인 후 연락",
        followUpRequired: true,
      });
      await fulfillJson(route, { data: { ...consultationSession, status: "RESOLVED" } });
      return true;
    }

    return false;
  });
}
