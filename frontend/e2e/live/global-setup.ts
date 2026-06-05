/// <reference types="node" />
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { request as playwrightRequest } from "@playwright/test";

import { getBaseURL, getCredentials, requireProdConfirmed } from "./env";
import { loginViaApi } from "./support/auth";

const LIVE_ROOT = dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = resolve(LIVE_ROOT, ".auth");
export const STORAGE_STATE_PATH = resolve(AUTH_DIR, "state.json");

function isExplicitGitHubActionsRun(): boolean {
  return (
    process.env.GITHUB_ACTIONS === "true" &&
    process.env.GITHUB_EVENT_NAME === "workflow_dispatch" &&
    process.env.E2E_ALLOW_GITHUB_ACTIONS === "true"
  );
}

// Playwright storageState 형식. origin별 localStorage 항목으로 토큰/유저를 주입한다.
interface StorageStateOrigin {
  origin: string;
  localStorage: { name: string; value: string }[];
}

interface StorageState {
  cookies: never[];
  origins: StorageStateOrigin[];
}

async function globalSetup(): Promise<void> {
  // 라이브 스모크는 운영 백엔드를 실제로 호출하므로 자동 CI 실행을 차단한다.
  // GitHub Actions에서는 workflow_dispatch + 명시 승인 env가 있는 수동 실행만 허용한다.
  if (process.env.CI && !isExplicitGitHubActionsRun()) {
    throw new Error(
      "[live-e2e] 라이브 스모크는 자동 CI에서 실행할 수 없습니다. 로컬에서 수동 실행하거나 Live E2E workflow_dispatch를 사용하세요.",
    );
  }

  // E2E_BASE_URL 필수 + 운영 대상이면 확인 토큰 검증. getCredentials는 자격증명 누락 시 throw.
  const baseURL = getBaseURL();
  requireProdConfirmed();
  getCredentials();

  // 실제 운영 로그인으로 토큰을 발급받아 storageState로 저장한다.
  const requestContext = await playwrightRequest.newContext();
  let session;
  try {
    session = await loginViaApi(requestContext);
  } finally {
    await requestContext.dispose();
  }

  const origin = new URL(baseURL).origin;
  const state: StorageState = {
    cookies: [],
    origins: [
      {
        origin,
        localStorage: [
          { name: "accessToken", value: session.accessToken },
          { name: "refreshToken", value: session.refreshToken },
          {
            name: "user",
            value: JSON.stringify({
              id: session.user.id,
              email: session.user.email,
              name: session.user.name,
              role: session.user.role,
            }),
          },
        ],
      },
    ],
  };

  mkdirSync(AUTH_DIR, { recursive: true });
  writeFileSync(STORAGE_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export default globalSetup;
