#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  findRequiredEnvIssues,
  parseEnvFile,
  REQUIRED_ENV_KEYS,
  resolveHostPorts,
} from "./dev-setup.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const ENV_FILE = join(ROOT, ".env");
const MISE_FILE = join(ROOT, "mise.toml");
const ROOT_PACKAGE_FILE = join(ROOT, "package.json");
const PYTHON_VERSION_FILE = join(ROOT, "ml/.python-version");
const BACKEND_JAR_PREFLIGHT_FILE = join(
  ROOT,
  "scripts/preflight-backend-jar.mjs",
);
const HOST_PORT_OVERRIDE_KEYS = [
  "POSTGRES_HOST_PORT",
  "BACKEND_HOST_PORT",
  "FRONTEND_HOST_PORT",
];

function readText(path) {
  return readFileSync(path, "utf8");
}

export function parseMiseTools(content) {
  const tools = {};
  let inTools = false;
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (/^\[.+]$/.test(line)) {
      inTools = line === "[tools]";
      continue;
    }
    if (!inTools) continue;
    const match = line.match(/^([A-Za-z0-9_-]+)\s*=\s*"([^"]+)"$/);
    if (match) tools[match[1]] = match[2];
  }
  return tools;
}

export function parsePackageManagerVersion(packageJson) {
  const parsed = JSON.parse(packageJson);
  const raw = parsed.packageManager ?? "";
  const match = raw.match(/^pnpm@(.+)$/);
  return match?.[1] ?? null;
}

export function normalizeVersion(output) {
  const match = output.match(/(\d+(?:\.\d+){0,2})/);
  return match?.[1] ?? null;
}

export function expectedMajor(raw) {
  return normalizeVersion(raw)?.split(".")[0] ?? null;
}

export function versionMatches(actual, expected, mode) {
  if (!actual || !expected) return false;
  if (mode === "major") return actual.split(".")[0] === expected;
  if (mode === "prefix")
    return actual === expected || actual.startsWith(`${expected}.`);
  return actual === expected;
}

export function effectiveEnv(envFromFile, processEnv = process.env) {
  const merged = { ...envFromFile };
  const overlayKeys = [
    ...REQUIRED_ENV_KEYS.map(({ key }) => key),
    ...HOST_PORT_OVERRIDE_KEYS,
  ];
  for (const key of overlayKeys) {
    if (processEnv[key] !== undefined) merged[key] = processEnv[key];
  }
  return merged;
}

export function classifyPortStatus({ service, port, inUse, runningServices }) {
  if (!inUse) {
    return {
      status: "pass",
      title: `port ${port} (${service})`,
      detail: "free",
    };
  }
  if (runningServices.has(service)) {
    return {
      status: "pass",
      title: `port ${port} (${service})`,
      detail: "already used by this compose service",
    };
  }
  return {
    status: "fail",
    title: `port ${port} (${service})`,
    detail: "already in use",
    guide:
      "Stop the process using the port, run `pnpm run down` for an old compose stack, or set the matching *_HOST_PORT override in .env.",
  };
}

export function summarize(results) {
  return results.reduce(
    (acc, check) => {
      acc[check.status] += 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0 },
  );
}

function result(status, title, detail, guide = null) {
  return { status, title, detail, guide };
}

function run(command, args) {
  return spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
  });
}

function expectedLabel(expected, mode) {
  if (mode === "major") return `major ${expected}`;
  if (mode === "prefix") return `${expected}.x`;
  return expected;
}

function runVersionCheck({ title, command, args, expected, mode, guide }) {
  const r = run(command, args);
  if (r.status !== 0) {
    return result("fail", title, `${command} not available`, guide);
  }
  const output = `${r.stdout}\n${r.stderr}`.trim();
  const actual = normalizeVersion(output);
  if (!versionMatches(actual, expected, mode)) {
    return result(
      "fail",
      title,
      `expected ${expectedLabel(expected, mode)}, got ${actual ?? output}`,
      guide,
    );
  }
  return result("pass", title, actual);
}

function runCandidateVersionCheck({
  title,
  candidates,
  expected,
  mode,
  guide,
}) {
  const attempts = candidates.map(({ command, args }) => ({
    command,
    check: runVersionCheck({ title, command, args, expected, mode, guide }),
  }));
  const passing = attempts.find(({ check }) => check.status === "pass");
  if (passing) {
    return result("pass", title, `${passing.command} ${passing.check.detail}`);
  }
  const availableMismatch = attempts.find(
    ({ check }) => !check.detail.includes("not available"),
  );
  return availableMismatch?.check ?? attempts[0].check;
}

function loadExpectedVersions() {
  const miseTools = parseMiseTools(readText(MISE_FILE));
  const pnpmVersion = parsePackageManagerVersion(readText(ROOT_PACKAGE_FILE));
  const pythonVersion = readText(PYTHON_VERSION_FILE).trim();
  return {
    javaMajor: expectedMajor(miseTools.java),
    node: miseTools.node,
    pnpm: pnpmVersion,
    python: pythonVersion || miseTools.python,
    uv: miseTools.uv,
  };
}

function checkTools() {
  const expected = loadExpectedVersions();
  return [
    runVersionCheck({
      title: "Java",
      command: "java",
      args: ["-version"],
      expected: expected.javaMajor,
      mode: "major",
      guide: "Run `mise install` or install Temurin Java 21.",
    }),
    runVersionCheck({
      title: "Node",
      command: "node",
      args: ["--version"],
      expected: expected.node,
      mode: "exact",
      guide: "Run `mise install` from the repository root.",
    }),
    runVersionCheck({
      title: "pnpm",
      command: "pnpm",
      args: ["--version"],
      expected: expected.pnpm,
      mode: "exact",
      guide:
        "Run `corepack enable` and `mise install` from the repository root.",
    }),
    runCandidateVersionCheck({
      title: "Python",
      candidates: [
        { command: "python3", args: ["--version"] },
        { command: "python", args: ["--version"] },
      ],
      expected: expected.python,
      mode: "prefix",
      guide: "Run `mise install` from the repository root.",
    }),
    runVersionCheck({
      title: "uv",
      command: "uv",
      args: ["--version"],
      expected: expected.uv,
      mode: "exact",
      guide: "Run `mise install` from the repository root.",
    }),
  ];
}

function checkDocker() {
  const dockerVersion = run("docker", ["--version"]);
  if (dockerVersion.status !== 0) {
    return [
      result(
        "fail",
        "Docker CLI",
        "docker not available",
        "Install and start Docker Desktop, or install docker CLI with the compose plugin.",
      ),
      result(
        "fail",
        "Docker Compose",
        "skipped because docker is not available",
        "Install Docker Desktop, or install docker CLI with the compose plugin.",
      ),
      result(
        "fail",
        "Docker daemon",
        "skipped because docker is not available",
        "Start Docker Desktop and retry.",
      ),
    ];
  }

  const compose = run("docker", ["compose", "version"]);
  const daemon = run("docker", ["info"]);
  return [
    result(
      "pass",
      "Docker CLI",
      normalizeVersion(dockerVersion.stdout) ?? dockerVersion.stdout.trim(),
    ),
    compose.status === 0
      ? result(
          "pass",
          "Docker Compose",
          normalizeVersion(compose.stdout) ?? compose.stdout.trim(),
        )
      : result(
          "fail",
          "Docker Compose",
          "docker compose not available",
          "Install Docker Desktop or the docker compose plugin.",
        ),
    daemon.status === 0
      ? result("pass", "Docker daemon", "running")
      : result(
          "fail",
          "Docker daemon",
          "not reachable",
          "Start Docker Desktop and retry.",
        ),
  ];
}

function checkEnv() {
  if (!existsSync(ENV_FILE)) {
    return [
      result(
        "fail",
        ".env",
        "missing",
        "Run `pnpm run dev:setup` to create it from .env.example.",
      ),
    ];
  }

  const env = effectiveEnv(parseEnvFile(readText(ENV_FILE)));
  const issues = findRequiredEnvIssues(env);
  if (issues.length === 0) {
    return [result("pass", ".env", "required keys are set")];
  }
  return issues.map(({ key, reason, hint }) =>
    result(
      "fail",
      `.env ${key}`,
      reason,
      `${hint} Update .env, then rerun doctor.`,
    ),
  );
}

function runningComposeServices() {
  const r = run("docker", [
    "compose",
    "ps",
    "--status",
    "running",
    "--services",
  ]);
  if (r.status !== 0) return new Set();
  return new Set(
    r.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );
}

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

async function checkPorts(profile) {
  const env = existsSync(ENV_FILE)
    ? effectiveEnv(parseEnvFile(readText(ENV_FILE)))
    : effectiveEnv({});
  const runningServices = runningComposeServices();
  const checks = [];
  for (const port of resolveHostPorts(env, profile)) {
    checks.push(
      classifyPortStatus({
        ...port,
        inUse: await isPortInUse(port.port),
        runningServices,
      }),
    );
  }
  return checks;
}

function checkComposeConfig(profile) {
  const r = spawnSync("docker", ["compose", "config", "--quiet"], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, COMPOSE_PROFILES: profile },
  });
  if (r.status === 0) {
    return result(
      "pass",
      "docker compose config",
      `valid (profile=${profile})`,
    );
  }
  return result(
    "fail",
    "docker compose config",
    `invalid (profile=${profile})`,
    r.stderr.trim() ||
      "Run `pnpm run dev:setup` for the full compose preflight.",
  );
}

function checkBackendJar() {
  const r = spawnSync(
    process.execPath,
    [BACKEND_JAR_PREFLIGHT_FILE, "--check-only"],
    {
      cwd: ROOT,
      encoding: "utf8",
    },
  );
  return r.status === 0
    ? result("pass", "backend JAR", "ready")
    : result(
        "fail",
        "backend JAR",
        "missing or older than backend sources",
        "Run `pnpm run build:backend:jar`.",
      );
}

function parseArgs(argv) {
  const profileIndex = argv.indexOf("--profile");
  const profile = profileIndex >= 0 ? argv[profileIndex + 1] : "full";
  if (!["light", "pipeline", "full"].includes(profile ?? "")) {
    return {
      error: `Unknown profile: ${profile}. Use light, pipeline, or full.`,
    };
  }
  return { profile };
}

function printResult(check) {
  const label = check.status.toUpperCase().padEnd(4, " ");
  process.stdout.write(`[doctor] ${label} ${check.title}: ${check.detail}\n`);
  if (check.guide) process.stdout.write(`         Fix: ${check.guide}\n`);
}

export async function main(argv) {
  const args = parseArgs(argv);
  if (args.error) {
    process.stderr.write(`[doctor] ${args.error}\n`);
    return 1;
  }

  process.stdout.write(
    `[doctor] Ostone development environment check (profile=${args.profile})\n`,
  );

  const results = [...checkTools(), ...checkDocker(), ...checkEnv()];

  const dockerOk = !results.some(
    (check) => check.title.startsWith("Docker") && check.status === "fail",
  );
  const envOk = !results.some(
    (check) => check.title.startsWith(".env") && check.status === "fail",
  );
  if (dockerOk && envOk) {
    results.push(checkComposeConfig(args.profile));
  } else {
    results.push(
      result(
        "warn",
        "docker compose config",
        dockerOk
          ? "skipped because .env is not ready"
          : "skipped because Docker is not ready",
      ),
    );
  }

  results.push(...(await checkPorts(args.profile)));
  results.push(checkBackendJar());

  for (const check of results) printResult(check);

  const counts = summarize(results);
  process.stdout.write(
    `[doctor] Summary: ${counts.pass} passed, ${counts.warn} warning(s), ${counts.fail} failed\n`,
  );
  return counts.fail > 0 ? 1 : 0;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  process.exit(await main(process.argv.slice(2)));
}
