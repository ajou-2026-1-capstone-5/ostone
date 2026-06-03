/// <reference types="node" />
import type { APIRequestContext, Page } from "@playwright/test";

import { getBaseURL, getCredentials } from "../env";

// 라이브 로그인 API 응답 형태: { data: { accessToken, refreshToken, tokenType, expiresIn, user } }
export interface LiveAuthUser {
  readonly id: number;
  readonly email: string;
  readonly name: string;
  readonly role: string;
}

export interface LiveAuthSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly tokenType: string;
  readonly expiresIn: number;
  readonly user: LiveAuthUser;
}

interface LoginResponseBody {
  data?: Partial<LiveAuthSession>;
}

function assertSession(body: LoginResponseBody): LiveAuthSession {
  const data = body.data;
  if (
    !data ||
    typeof data.accessToken !== "string" ||
    typeof data.refreshToken !== "string" ||
    typeof data.tokenType !== "string" ||
    typeof data.expiresIn !== "number" ||
    !data.user ||
    typeof data.user.id !== "number" ||
    typeof data.user.email !== "string" ||
    typeof data.user.name !== "string" ||
    typeof data.user.role !== "string"
  ) {
    throw new Error("[live-e2e] 로그인 응답 형태가 예상과 다릅니다.");
  }
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    tokenType: data.tokenType,
    expiresIn: data.expiresIn,
    user: {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      role: data.user.role,
    },
  };
}

// 실제 운영 로그인 API를 호출해 토큰/유저를 받는다. globalSetup과 spec이 공유한다.
export async function loginViaApi(request: APIRequestContext): Promise<LiveAuthSession> {
  const { email, password } = getCredentials();
  const response = await request.post(`${getBaseURL()}/api/v1/auth/login`, {
    headers: { "Content-Type": "application/json" },
    data: { email, password },
  });

  if (!response.ok()) {
    throw new Error(
      `[live-e2e] 로그인 실패: ${response.status()} ${response.statusText()}. 자격증명을 확인하세요.`,
    );
  }

  return assertSession((await response.json()) as LoginResponseBody);
}

// UI 로그인 흐름을 직접 검증하는 spec용. 한국어 라벨 셀렉터를 사용한다.
export async function loginViaUi(page: Page): Promise<void> {
  const { email, password } = getCredentials();
  await page.goto("/login");
  await page.getByLabel("이메일 주소").fill(email);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "시스템 로그인" }).click();
  await page.waitForURL(/\/workspaces\/\d+\/workflows/);
}
