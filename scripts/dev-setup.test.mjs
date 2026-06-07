import assert from "node:assert/strict";
import { test } from "node:test";

import {
  findRequiredEnvIssues,
  generateJwtSecret,
  hostPort,
  isPlaceholder,
  materializeEnvExample,
  parseEnvFile,
  renderAccessUrls,
  resolveHostPorts,
} from "./dev-setup.mjs";

test("parseEnvFile: KEY=VALUE 라인만 읽고 주석/빈 줄은 무시한다", () => {
  const env = parseEnvFile(
    [
      "# comment",
      "",
      "DB_NAME=init",
      "  JWT_SECRET = secret-value ",
      "AI_API_KEY=",
      "URL=http://a/b?x=1",
      "no-equals-line",
      "=no-key",
    ].join("\n"),
  );
  assert.deepEqual(env, {
    DB_NAME: "init",
    JWT_SECRET: "secret-value",
    AI_API_KEY: "",
    URL: "http://a/b?x=1",
  });
});

test("parseEnvFile: 양끝 동일 따옴표는 docker compose 처럼 벗긴다", () => {
  const env = parseEnvFile(
    ['A="quoted value"', "B='single'", 'C="unbalanced', 'D=""'].join("\n"),
  );
  assert.deepEqual(env, {
    A: "quoted value",
    B: "single",
    C: '"unbalanced',
    D: "",
  });
});

test("isPlaceholder: <...> 표식만 placeholder 로 판정한다", () => {
  assert.equal(isPlaceholder("<your-jwt-secret-at-least-32-bytes-long>"), true);
  assert.equal(isPlaceholder("real-secret-value"), false);
  assert.equal(isPlaceholder(""), false);
  assert.equal(isPlaceholder(undefined), false);
});

test("findRequiredEnvIssues: 누락/빈 값/placeholder 를 각각 보고한다", () => {
  const issues = findRequiredEnvIssues({
    JWT_SECRET: "",
    AIRFLOW_WEBHOOK_SECRET: "<fill-me>",
  });
  assert.deepEqual(
    issues.map(({ key, reason }) => ({ key, reason })),
    [
      { key: "DB_PASSWORD", reason: "누락" },
      { key: "JWT_SECRET", reason: "빈 값" },
      { key: "AIRFLOW_WEBHOOK_SECRET", reason: "placeholder 미치환" },
    ],
  );
  for (const issue of issues) assert.ok(issue.hint.length > 0);
});

test("findRequiredEnvIssues: 모두 채워지면 빈 배열", () => {
  assert.deepEqual(
    findRequiredEnvIssues({
      DB_PASSWORD: "init-db-password",
      JWT_SECRET: "x".repeat(40),
      AIRFLOW_WEBHOOK_SECRET: "change-me-airflow-webhook-secret",
    }),
    [],
  );
});

test("generateJwtSecret: 32바이트 이상이고 호출마다 달라진다", () => {
  const a = generateJwtSecret();
  const b = generateJwtSecret();
  assert.ok(a.length >= 32);
  assert.notEqual(a, b);
  assert.equal(isPlaceholder(a), false);
});

test("materializeEnvExample: JWT_SECRET placeholder 라인만 치환한다", () => {
  const example = [
    "DB_PASSWORD=init-db-password",
    "JWT_SECRET=<your-jwt-secret-at-least-32-bytes-long>",
    "TOSS_SECRET_KEY=<your-toss-secret-key>",
  ].join("\n");
  const out = materializeEnvExample(example, "generated-secret");
  const env = parseEnvFile(out);
  assert.equal(env.JWT_SECRET, "generated-secret");
  assert.equal(env.TOSS_SECRET_KEY, "<your-toss-secret-key>");
  assert.equal(env.DB_PASSWORD, "init-db-password");
});

test("materializeEnvExample: placeholder 가 없으면 원문을 유지한다", () => {
  const example = "JWT_SECRET=already-filled";
  assert.equal(materializeEnvExample(example, "x"), example);
});

test("hostPort: 양의 정수만 오버라이드로 인정한다", () => {
  assert.equal(hostPort({}, "BACKEND_HOST_PORT", 8080), 8080);
  assert.equal(
    hostPort({ BACKEND_HOST_PORT: "18080" }, "BACKEND_HOST_PORT", 8080),
    18080,
  );
  assert.equal(
    hostPort({ BACKEND_HOST_PORT: "abc" }, "BACKEND_HOST_PORT", 8080),
    8080,
  );
  assert.equal(
    hostPort({ BACKEND_HOST_PORT: "-1" }, "BACKEND_HOST_PORT", 8080),
    8080,
  );
});

test("resolveHostPorts: light 는 airflow 포트를 포함하지 않는다", () => {
  const ports = resolveHostPorts({}, "light");
  assert.deepEqual(
    ports.map((p) => p.port),
    [5432, 8080, 5173, 9000, 9001],
  );
  assert.ok(!ports.some((p) => p.service.startsWith("airflow")));
});

test("resolveHostPorts: pipeline/full 은 airflow 8081 을 포함하고 오버라이드를 반영한다", () => {
  for (const profile of ["pipeline", "full"]) {
    const ports = resolveHostPorts({ POSTGRES_HOST_PORT: "15432" }, profile);
    assert.ok(
      ports.some((p) => p.service === "airflow-apiserver" && p.port === 8081),
    );
    assert.ok(ports.some((p) => p.service === "postgres" && p.port === 15432));
  }
});

test("renderAccessUrls: light 는 FE/BE/MinIO 콘솔 URL 을 출력한다", () => {
  const lines = renderAccessUrls({}, "light");
  assert.equal(lines.length, 3);
  assert.ok(lines[0].includes("http://localhost:5173"));
  assert.ok(lines[1].includes("http://localhost:8080"));
  assert.ok(lines[2].includes("http://localhost:9001"));
  assert.ok(!lines.some((l) => l.includes("8081")));
});

test("renderAccessUrls: full 은 Airflow URL 을 포함하고 포트 오버라이드를 반영한다", () => {
  const lines = renderAccessUrls({ FRONTEND_HOST_PORT: "15173" }, "full");
  assert.ok(lines.some((l) => l.includes("http://localhost:8081")));
  assert.ok(lines.some((l) => l.includes("http://localhost:15173")));
});
