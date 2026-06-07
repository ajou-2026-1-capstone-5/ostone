import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classifyPortStatus,
  effectiveEnv,
  expectedMajor,
  normalizeVersion,
  parseMiseTools,
  parsePackageManagerVersion,
  summarize,
  versionMatches,
} from "./doctor.mjs";

test("parseMiseTools: [tools] section versions are extracted", () => {
  const tools = parseMiseTools(
    [
      "[env]",
      'FOO = "bar"',
      "",
      "[tools]",
      'java = "temurin-21"',
      'node = "22.13.0"',
      'pnpm = "10.33.0"',
      'python = "3.13"',
      'uv = "0.11.19"',
      "",
      "[settings]",
      'idiomatic_version_file_enable_tools = ["python"]',
    ].join("\n"),
  );
  assert.deepEqual(tools, {
    java: "temurin-21",
    node: "22.13.0",
    pnpm: "10.33.0",
    python: "3.13",
    uv: "0.11.19",
  });
});

test("parsePackageManagerVersion: root pnpm version is extracted", () => {
  assert.equal(
    parsePackageManagerVersion('{"packageManager":"pnpm@10.33.0"}'),
    "10.33.0",
  );
  assert.equal(parsePackageManagerVersion("{}"), null);
});

test("normalizeVersion and expectedMajor: common tool outputs are normalized", () => {
  assert.equal(
    normalizeVersion('openjdk version "21.0.7" 2026-04-15'),
    "21.0.7",
  );
  assert.equal(normalizeVersion("v22.13.0"), "22.13.0");
  assert.equal(normalizeVersion("uv 0.11.19 (Homebrew 2026-06-01)"), "0.11.19");
  assert.equal(expectedMajor("temurin-21"), "21");
});

test("versionMatches: exact, prefix, and major modes are supported", () => {
  assert.equal(versionMatches("22.13.0", "22.13.0", "exact"), true);
  assert.equal(versionMatches("22.13.1", "22.13.0", "exact"), false);
  assert.equal(versionMatches("3.13.4", "3.13", "prefix"), true);
  assert.equal(versionMatches("3.12.9", "3.13", "prefix"), false);
  assert.equal(versionMatches("21.0.7", "21", "major"), true);
  assert.equal(versionMatches("17.0.15", "21", "major"), false);
});

test("effectiveEnv: shell values override .env values for checked keys", () => {
  const env = effectiveEnv(
    {
      DB_PASSWORD: "file-db",
      JWT_SECRET: "file-jwt",
      AIRFLOW_WEBHOOK_SECRET: "file-airflow",
      BACKEND_HOST_PORT: "8080",
    },
    {
      JWT_SECRET: "shell-jwt",
      BACKEND_HOST_PORT: "18080",
      IGNORED: "value",
    },
  );
  assert.deepEqual(env, {
    DB_PASSWORD: "file-db",
    JWT_SECRET: "shell-jwt",
    AIRFLOW_WEBHOOK_SECRET: "file-airflow",
    BACKEND_HOST_PORT: "18080",
  });
});

test("classifyPortStatus: running compose service is not treated as collision", () => {
  const runningServices = new Set(["backend"]);
  assert.equal(
    classifyPortStatus({
      service: "backend",
      port: 8080,
      inUse: true,
      runningServices,
    }).status,
    "pass",
  );
  assert.equal(
    classifyPortStatus({
      service: "frontend",
      port: 5173,
      inUse: true,
      runningServices,
    }).status,
    "fail",
  );
});

test("summarize: counts pass, warn, and fail statuses", () => {
  assert.deepEqual(
    summarize([
      { status: "pass" },
      { status: "warn" },
      { status: "fail" },
      { status: "pass" },
    ]),
    { pass: 2, warn: 1, fail: 1 },
  );
});
