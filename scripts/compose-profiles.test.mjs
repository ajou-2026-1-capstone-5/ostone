import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// docker compose config 의 `:?` required 변수를 채워, .env 가 없는 CI 에서도
// profile 해석이 실패하지 않게 한다(이미 셸에 있으면 그 값을 존중).
const DUMMY_ENV = {
  ...process.env,
  DB_PASSWORD: process.env.DB_PASSWORD ?? "test-db-password",
  JWT_SECRET:
    process.env.JWT_SECRET ?? "test-jwt-secret-at-least-32-bytes-long-xxxx",
  AIRFLOW_WEBHOOK_SECRET:
    process.env.AIRFLOW_WEBHOOK_SECRET ?? "test-airflow-webhook-secret",
};

function dockerComposeAvailable() {
  const r = spawnSync("docker", ["compose", "version"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return r.status === 0;
}

function servicesForProfile(profile) {
  const r = spawnSync("docker", ["compose", "config", "--format", "json"], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...DUMMY_ENV, COMPOSE_PROFILES: profile },
    maxBuffer: 32 * 1024 * 1024,
  });
  assert.equal(
    r.status,
    0,
    `docker compose config failed (profile=${profile}): ${r.stderr}`,
  );
  return Object.keys(JSON.parse(r.stdout).services ?? {}).sort();
}

const skip = dockerComposeAvailable() ? false : "docker compose unavailable";

test("light (bare up) = product runtime only, no airflow", { skip }, () => {
  const services = servicesForProfile("light");
  assert.deepEqual(services, [
    "backend",
    "frontend",
    "minio",
    "minio-init",
    "postgres",
  ]);
  assert.ok(
    !services.some((s) => s.startsWith("airflow")),
    "light must not include any airflow service",
  );
});

test("full = every service including airflow + runtime", { skip }, () => {
  assert.deepEqual(servicesForProfile("full"), [
    "airflow-apiserver",
    "airflow-dag-processor",
    "airflow-init",
    "airflow-scheduler",
    "backend",
    "frontend",
    "minio",
    "minio-init",
    "postgres",
  ]);
});

test("minio-init bucket bootstrap is always-on across modes", { skip }, () => {
  assert.ok(servicesForProfile("light").includes("minio-init"));
  assert.ok(servicesForProfile("full").includes("minio-init"));
});

test("up:pipeline starts the airflow stack but not backend/frontend", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const cmd = pkg.scripts["up:pipeline"];
  assert.ok(cmd, "up:pipeline script must exist");
  for (const svc of [
    "postgres",
    "minio",
    "minio-init",
    "airflow-init",
    "airflow-apiserver",
    "airflow-scheduler",
    "airflow-dag-processor",
  ]) {
    assert.ok(cmd.includes(svc), `up:pipeline must start ${svc}`);
  }
  assert.ok(!cmd.includes("backend"), "lean pipeline must not start backend");
  assert.ok(!cmd.includes("frontend"), "lean pipeline must not start frontend");
});
