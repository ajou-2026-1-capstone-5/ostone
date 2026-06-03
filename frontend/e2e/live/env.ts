/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// 라이브 스모크 e2e는 운영 백엔드를 실제로 호출하므로 자격증명/대상 URL을 환경변수로만 받는다.
// 하드코딩 기본값이나 평문 secret을 코드/예시에 두지 않는다.

const FRONTEND_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ENV_FILE = resolve(FRONTEND_ROOT, ".env.e2e.local");

const PROD_HOST = "app.ajou-cstone.com";

let loaded = false;

// 새 의존성(dotenv) 없이 node 내장 모듈로 .env.e2e.local을 process.env에 병합한다.
// 이미 process.env에 있는 값은 덮어쓰지 않아 셸에서 직접 넘긴 값이 우선한다.
function loadEnvFile(): void {
  if (loaded) {
    return;
  }
  loaded = true;

  if (!existsSync(ENV_FILE)) {
    return;
  }

  const content = readFileSync(ENV_FILE, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }

    const key = line.slice(0, eqIndex).trim();
    if (key.length === 0 || process.env[key] !== undefined) {
      continue;
    }

    let value = line.slice(eqIndex + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function readRequired(key: string): string {
  loadEnvFile();
  const value = process.env[key];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(
      `[live-e2e] 필수 환경변수 ${key}가 설정되지 않았습니다. frontend/.env.e2e.example을 참고해 .env.e2e.local을 작성하세요.`,
    );
  }
  return value.trim();
}

export interface LiveCredentials {
  readonly email: string;
  readonly password: string;
}

export function getBaseURL(): string {
  const raw = readRequired("E2E_BASE_URL");
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`[live-e2e] E2E_BASE_URL이 유효한 URL이 아닙니다: ${raw}`);
  }
  // 끝의 슬래시를 제거해 API path 조합 시 중복 슬래시를 막는다.
  return parsed.toString().replace(/\/$/, "");
}

export function getCredentials(): LiveCredentials {
  return {
    email: readRequired("E2E_EMAIL"),
    password: readRequired("E2E_PASSWORD"),
  };
}

// 운영 환경(app.ajou-cstone.com)을 대상으로 할 때는 오실행 방지를 위해
// E2E_CONFIRM_PROD가 운영 host와 정확히 일치해야만 통과시킨다.
export function requireProdConfirmed(): void {
  loadEnvFile();
  const host = new URL(getBaseURL()).host;
  if (host !== PROD_HOST) {
    return;
  }

  const confirm = process.env.E2E_CONFIRM_PROD?.trim();
  if (confirm !== PROD_HOST) {
    throw new Error(
      `[live-e2e] 운영 환경(${PROD_HOST}) 대상 실행입니다. 의도한 경우 E2E_CONFIRM_PROD=${PROD_HOST}를 설정하세요.`,
    );
  }
}

// 운영 데이터에 쓰기(워크스페이스 생성 등)를 수행하는 spec을 활성화할지 결정한다.
// 명시적으로 허용하지 않으면 데이터 오염을 막기 위해 기본 비활성.
export function isPollutingAllowed(): boolean {
  loadEnvFile();
  return process.env.E2E_ALLOW_POLLUTING?.trim() === "true";
}

export { PROD_HOST };
