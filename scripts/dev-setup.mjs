#!/usr/bin/env node
// 로컬 개발 원커맨드 부트스트랩. .env 준비 → 필수 환경 변수 점검 → backend jar
// preflight → docker compose 설정 검증 → 호스트 포트 사전 점검 순서로 수행하고,
// 실패 시 어떤 값이 필요한지와 다음 조치를 로그로 남긴다.
// `--print-urls` 는 준비 단계를 건너뛰고 접속 URL 표만 출력한다(up 직후 사용).
// `--profile <light|pipeline|full>` 은 compose 설정 검증과 포트/URL 범위를 정한다.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { main as preflightBackendJar } from "./preflight-backend-jar.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const ENV_FILE = join(ROOT, ".env");
const ENV_EXAMPLE_FILE = join(ROOT, ".env.example");

// docker-compose.yml 이 기본값 없이 요구하는 변수들. `:?` required(JWT_SECRET,
// AIRFLOW_WEBHOOK_SECRET)와, 비어 있으면 postgres 컨테이너가 기동하지 못하는
// DB_PASSWORD 를 함께 점검한다.
export const REQUIRED_ENV_KEYS = [
  {
    key: "DB_PASSWORD",
    hint: "로컬 PostgreSQL 비밀번호. 로컬 전용 임의 문자열이면 충분하다.",
  },
  {
    key: "JWT_SECRET",
    hint: "32바이트 이상 임의 문자열. dev:setup 이 .env 생성 시 자동으로 채운다.",
  },
  {
    key: "AIRFLOW_WEBHOOK_SECRET",
    hint: "Airflow → backend 웹훅 검증용 임의 문자열.",
  },
];

export function parseEnvFile(content) {
  const env = {};
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    let value = line.slice(eq + 1).trim();
    // docker compose 와 동일하게 양끝의 동일 따옴표 한 쌍은 벗긴다.
    if (
      value.length >= 2 &&
      (value.startsWith('"') || value.startsWith("'")) &&
      value.endsWith(value[0])
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, eq).trim()] = value;
  }
  return env;
}

// .env.example 의 미기입 표식(`<...>`) 판정. 값이 채워졌는지 검사할 때 쓴다.
export function isPlaceholder(value) {
  return /^<.*>$/.test(value ?? "");
}

export function findRequiredEnvIssues(env) {
  const issues = [];
  for (const { key, hint } of REQUIRED_ENV_KEYS) {
    if (!(key in env)) issues.push({ key, reason: "누락", hint });
    else if (env[key] === "") issues.push({ key, reason: "빈 값", hint });
    else if (isPlaceholder(env[key]))
      issues.push({ key, reason: "placeholder 미치환", hint });
  }
  return issues;
}

export function generateJwtSecret() {
  // 48바이트 → base64url 64자. JWT HMAC 서명 키 최소 32바이트 요건을 만족한다.
  return randomBytes(48).toString("base64url");
}

// .env.example 내용에서 JWT_SECRET placeholder 라인만 생성 값으로 치환한다.
// 다른 placeholder(TOSS_* 등)는 옵션 값이므로 그대로 둔다.
export function materializeEnvExample(exampleContent, jwtSecret) {
  return exampleContent.replace(
    /^JWT_SECRET=<[^\n]*>\s*$/m,
    `JWT_SECRET=${jwtSecret}`,
  );
}

export function hostPort(env, key, fallback) {
  const n = Number.parseInt(env[key] ?? "", 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

// profile 에서 기동되는 서비스의 호스트 포트 목록. *_HOST_PORT 오버라이드를
// 반영하고, minio(9000/9001)와 airflow(127.0.0.1:8081)는 compose 에 고정이다.
export function resolveHostPorts(env, profile = "light") {
  const ports = [
    { service: "postgres", port: hostPort(env, "POSTGRES_HOST_PORT", 5432) },
    { service: "backend", port: hostPort(env, "BACKEND_HOST_PORT", 8080) },
    { service: "frontend", port: hostPort(env, "FRONTEND_HOST_PORT", 5173) },
    { service: "minio", port: 9000 },
    { service: "minio", port: 9001 },
  ];
  if (profile === "pipeline" || profile === "full") {
    ports.push({ service: "airflow-apiserver", port: 8081 });
  }
  return ports;
}

export function renderAccessUrls(env, profile = "light") {
  const frontendPort = hostPort(env, "FRONTEND_HOST_PORT", 5173);
  const backendPort = hostPort(env, "BACKEND_HOST_PORT", 8080);
  const lines = [
    `Frontend (운영자 콘솔)  http://localhost:${frontendPort}`,
    `Backend API             http://localhost:${backendPort}`,
    `MinIO 콘솔              http://localhost:9001`,
  ];
  if (profile === "pipeline" || profile === "full") {
    lines.push(`Airflow                 http://localhost:8081`);
  }
  return lines;
}

function log(message) {
  process.stdout.write(`[dev-setup] ${message}\n`);
}

function fail(message) {
  process.stderr.write(`[dev-setup] ${message}\n`);
}

function dockerComposeAvailable() {
  const r = spawnSync("docker", ["compose", "version"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return r.status === 0;
}

function dockerDaemonRunning() {
  const r = spawnSync("docker", ["info"], { cwd: ROOT, encoding: "utf8" });
  return r.status === 0;
}

function validateComposeConfig(profile) {
  return spawnSync("docker", ["compose", "config", "--quiet"], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, COMPOSE_PROFILES: profile },
  });
}

function runningComposeServices() {
  const r = spawnSync(
    "docker",
    ["compose", "ps", "--status", "running", "--services"],
    { cwd: ROOT, encoding: "utf8" },
  );
  if (r.status !== 0) return new Set();
  return new Set(
    r.stdout
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

// 127.0.0.1:port 에 listener 가 있는지 TCP 접속으로 확인한다(점검 실패는 미점유로 간주).
function isPortInUse(port) {
  return new Promise((resolvePromise) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    const finish = (inUse) => {
      socket.destroy();
      resolvePromise(inUse);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(700, () => finish(false));
  });
}

function readEnvFileIfExists() {
  return existsSync(ENV_FILE)
    ? parseEnvFile(readFileSync(ENV_FILE, "utf8"))
    : {};
}

const HOST_PORT_OVERRIDE_KEYS = [
  "POSTGRES_HOST_PORT",
  "BACKEND_HOST_PORT",
  "FRONTEND_HOST_PORT",
];

// .env 와 셸 환경변수를 합친 유효 값. docker compose 는 셸 값을 우선한다.
function effectiveEnv(envFromFile) {
  const merged = { ...envFromFile };
  const overlayKeys = [
    ...REQUIRED_ENV_KEYS.map(({ key }) => key),
    ...HOST_PORT_OVERRIDE_KEYS,
  ];
  for (const key of overlayKeys) {
    if (process.env[key] !== undefined) merged[key] = process.env[key];
  }
  return merged;
}

function printAccessUrls(env, profile) {
  log("접속 포인트");
  for (const line of renderAccessUrls(env, profile)) {
    process.stdout.write(`            ${line}\n`);
  }
  log("backend 가 healthy 될 때까지 최대 1분 걸린다. 확인: pnpm run smoke");
  log("데모 계정은 README '데모 시드 데이터' 항목을 참조한다.");
}

function ensureEnvFile() {
  if (existsSync(ENV_FILE)) {
    log(".env 확인 — 기존 파일을 그대로 사용한다(자동 수정 없음).");
    return 0;
  }
  if (!existsSync(ENV_EXAMPLE_FILE)) {
    fail(
      ".env 와 .env.example 이 모두 없다. 저장소 루트에서 실행했는지 확인한다.",
    );
    return 1;
  }
  const example = readFileSync(ENV_EXAMPLE_FILE, "utf8");
  writeFileSync(ENV_FILE, materializeEnvExample(example, generateJwtSecret()), {
    flag: "wx",
  });
  log(".env 가 없어 .env.example 기반으로 생성했다.");
  log("JWT_SECRET 은 로컬 전용 랜덤 값으로 채웠다.");
  log(
    "AI 채팅(AI_API_KEY)·토스 결제(TOSS_*) 등 옵션 값은 필요할 때 .env 에서 채운다.",
  );
  return 0;
}

async function checkPorts(env, profile) {
  const running = runningComposeServices();
  const alreadyRunning = new Set();
  for (const { service, port } of resolveHostPorts(env, profile)) {
    if (running.has(service)) {
      alreadyRunning.add(service);
      continue;
    }
    if (await isPortInUse(port)) {
      log(
        `경고: 포트 ${port}(${service}) 를 다른 프로세스가 점유 중이다. ` +
          "해당 프로세스를 종료하거나 README '포트 충돌 대응'을 참조한다.",
      );
    }
  }
  if (alreadyRunning.size > 0) {
    log(
      `이미 실행 중인 서비스: ${[...alreadyRunning].join(", ")} — ` +
        "docker compose 가 그대로 재사용한다.",
    );
  }
}

export async function main(argv) {
  const profileFlagIndex = argv.indexOf("--profile");
  const profile = profileFlagIndex >= 0 ? argv[profileFlagIndex + 1] : "light";
  if (!["light", "pipeline", "full"].includes(profile ?? "")) {
    fail(`알 수 없는 profile: ${profile}. light|pipeline|full 중 하나를 쓴다.`);
    return 1;
  }

  if (argv.includes("--print-urls")) {
    printAccessUrls(effectiveEnv(readEnvFileIfExists()), profile);
    return 0;
  }

  if (!dockerComposeAvailable()) {
    fail("docker compose 를 찾을 수 없다. Docker Desktop(또는 docker CLI + ");
    fail("compose plugin)을 설치한 뒤 다시 실행한다.");
    return 1;
  }
  if (!dockerDaemonRunning()) {
    fail("Docker daemon 에 연결할 수 없다. Docker Desktop 을 실행한 뒤 다시 ");
    fail("시도한다.");
    return 1;
  }

  const envFileStatus = ensureEnvFile();
  if (envFileStatus !== 0) return envFileStatus;

  const env = effectiveEnv(readEnvFileIfExists());
  const issues = findRequiredEnvIssues(env);
  if (issues.length > 0) {
    fail("필수 환경 변수 점검 실패:");
    for (const { key, reason, hint } of issues) {
      fail(`  - ${key} (${reason}): ${hint}`);
    }
    fail("조치: .env 에서 위 값을 채운 뒤 다시 실행한다.");
    return 1;
  }
  log("필수 환경 변수 점검 통과.");

  const preflightStatus = preflightBackendJar([]);
  if (preflightStatus !== 0) {
    fail("backend jar 준비에 실패했다. 위 Gradle 로그를 확인한다.");
    return preflightStatus;
  }

  const config = validateComposeConfig(profile);
  if (config.status !== 0) {
    fail(`docker compose 설정 검증 실패(profile=${profile}):`);
    fail(config.stderr.trim());
    return 1;
  }
  log(`docker compose 설정 검증 통과(profile=${profile}).`);

  await checkPorts(env, profile);

  log("준비 완료. 기동: pnpm run dev (light) / pnpm run up:full (전체)");
  return 0;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  process.exit(await main(process.argv.slice(2)));
}
