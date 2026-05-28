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

async function fulfillWorkspaceShell(
  route: Route,
  method: string,
  path: string,
): Promise<boolean> {
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
    await fulfillJson(route, { data: { ...pack.versions[0], packId: 1, summaryJson: "{}" } });
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
      await fulfillJson(route, { data: [consultationSession] });
      return true;
    }

    if (method === "GET" && path === "/consultation/sessions/601/messages") {
      await fulfillJson(route, {
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
      return true;
    }

    if (method === "PATCH" && path === "/consultation/sessions/601/status") {
      expect(route.request().postDataJSON()).toEqual({ status: "COMPLETED" });
      await fulfillJson(route, { data: { ...consultationSession, status: "COMPLETED" } });
      return true;
    }

    return false;
  });
}
