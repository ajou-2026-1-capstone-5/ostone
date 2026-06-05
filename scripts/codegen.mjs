#!/usr/bin/env node
// 원커맨드 codegen: backend OpenAPI(generateOpenApiDocs) → frontend orval(api:gen).
// 사전조건(.env / JWT_SECRET / postgres:5432 / port 8089)을 먼저 검증하고, 실패 시
// backend 부팅 실패(exit 10) / openapi 누락(exit 11) / orval 실패(exit 20)를 구분한다.
// generateOpenApiDocs 는 local 프로필 앱을 forked 로 띄우므로 .env 값을 자식 프로세스
// 환경에 주입해 JWT_SECRET 등을 셸에서 export 하지 않아도 동작하게 한다.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createConnection } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const ENV_FILE = join(ROOT, ".env");
const OPENAPI = join(ROOT, "backend/build/openapi.json");

export const EXIT = { ENV: 2, BACKEND: 10, OPENAPI_MISSING: 11, ORVAL: 20 };

// 의존성 없는 최소 .env 파서. KEY=VALUE 만, 주석/빈 줄 무시, 따옴표 1겹 제거.
export function parseDotenv(text) {
  const out = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

export function preconditionErrors({
  hasEnvFile,
  jwtSecret,
  pgReachable,
  port8089Free,
}) {
  const errors = [];
  if (!hasEnvFile) {
    errors.push({
      code: EXIT.ENV,
      message: "Missing .env. Run: cp .env.example .env",
    });
  }
  if (!jwtSecret) {
    errors.push({
      code: EXIT.ENV,
      message:
        "JWT_SECRET is not set (shell env or .env). generateOpenApiDocs boots the " +
        "local-profile app which requires it.",
    });
  }
  if (!pgReachable) {
    errors.push({
      code: EXIT.ENV,
      message:
        "PostgreSQL not reachable on localhost:5432. Start it first: pnpm run up:light",
    });
  }
  if (!port8089Free) {
    errors.push({
      code: EXIT.ENV,
      message:
        "Port 8089 is in use; generateOpenApiDocs boots a forked app there. Free it and retry.",
    });
  }
  return errors;
}

export function backendFailure(status) {
  return {
    code: EXIT.BACKEND,
    message:
      `BACKEND OpenAPI generation failed (generateOpenApiDocs exit ${status}). ` +
      "Likely DB unreachable / Liquibase mismatch / JWT_SECRET / port 8089 busy. " +
      "Ensure the local DB is healthy (pnpm run up:light) and retry: pnpm run codegen.",
  };
}

export function openapiMissingFailure(openapiPath) {
  return {
    code: EXIT.OPENAPI_MISSING,
    message:
      `Expected ${openapiPath} after generateOpenApiDocs but it is missing. ` +
      "The forked app may have failed to expose /v3/api-docs in time. " +
      "Re-run, or generate manually: cd backend && ./gradlew generateOpenApiDocs.",
  };
}

export function orvalFailure(status) {
  return {
    code: EXIT.ORVAL,
    message:
      `FRONTEND orval generation failed (orval exit ${status}). openapi.json was ` +
      "produced OK, so this is an orval/codegen-config issue, not a backend boot " +
      "failure. Inspect the orval output above.",
  };
}

function tcpOpen(host, port, timeoutMs = 1500) {
  return new Promise((resolveP) => {
    const socket = createConnection({ host, port });
    const done = (result) => {
      socket.destroy();
      resolveP(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function fail(err) {
  process.stderr.write(`\n[codegen] ${err.message}\n`);
  process.exit(err.code);
}

async function main() {
  const hasEnvFile = existsSync(ENV_FILE);
  const dotenv = hasEnvFile ? parseDotenv(readFileSync(ENV_FILE, "utf8")) : {};
  const childEnv = { ...dotenv, ...process.env };

  const [pgReachable, port8089Open] = await Promise.all([
    tcpOpen("localhost", 5432),
    tcpOpen("localhost", 8089),
  ]);

  const errors = preconditionErrors({
    hasEnvFile,
    jwtSecret: Boolean(childEnv.JWT_SECRET),
    pgReachable,
    port8089Free: !port8089Open,
  });
  if (errors.length > 0) {
    for (const e of errors) process.stderr.write(`[codegen] ${e.message}\n`);
    process.exit(errors[0].code);
  }

  process.stdout.write(
    "[codegen] 1/2 backend OpenAPI (generateOpenApiDocs)…\n",
  );
  const be = spawnSync("./gradlew", ["generateOpenApiDocs"], {
    cwd: join(ROOT, "backend"),
    stdio: "inherit",
    env: childEnv,
  });
  if (be.status !== 0) fail(backendFailure(be.status));
  if (!existsSync(OPENAPI)) fail(openapiMissingFailure(OPENAPI));

  process.stdout.write("[codegen] 2/2 frontend client (orval api:gen)…\n");
  const fe = spawnSync("pnpm", ["--dir", "frontend", "api:gen"], {
    cwd: ROOT,
    stdio: "inherit",
    env: childEnv,
  });
  if (fe.status !== 0) fail(orvalFailure(fe.status));

  process.stdout.write(
    "[codegen] OK — backend openapi.json + frontend generated client + .codegen-meta.json updated.\n",
  );
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((e) => {
    process.stderr.write(`[codegen] unexpected error: ${e?.stack ?? e}\n`);
    process.exit(1);
  });
}
