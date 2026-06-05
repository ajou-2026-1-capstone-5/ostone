#!/usr/bin/env node
// backend/build/libs/app.jar 가 docker compose 로 마운트되기 전에 존재·신선도를
// 확인한다. 누락/stale 이면 기본적으로 `./gradlew bootJar` 로 자동 빌드하고,
// --check-only 면 빌드 없이 안내 후 exit 1 한다(doctor/CI 용).
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const JAR = join(ROOT, "backend/build/libs/app.jar");
const SOURCE_PATHS = [
  join(ROOT, "backend/src/main"),
  join(ROOT, "backend/build.gradle.kts"),
  join(ROOT, "backend/settings.gradle.kts"),
];

// 주어진 파일/디렉터리(재귀)에서 가장 최근 mtime(ms)을 반환한다. 존재하지 않는
// 경로는 건너뛴다. 비교 대상이 하나도 없으면 0.
export function newestMtimeMs(paths) {
  let newest = 0;
  const visit = (p) => {
    let st;
    try {
      st = statSync(p);
    } catch {
      return;
    }
    if (st.isDirectory()) {
      for (const entry of readdirSync(p)) visit(join(p, entry));
    } else if (st.mtimeMs > newest) {
      newest = st.mtimeMs;
    }
  };
  for (const p of paths) visit(p);
  return newest;
}

export function isJarStale(jarMtimeMs, srcMtimeMs) {
  return srcMtimeMs > jarMtimeMs;
}

export function resolveMode({ jarExists, jarMtimeMs, srcMtimeMs }) {
  if (!jarExists) return "missing";
  if (isJarStale(jarMtimeMs, srcMtimeMs)) return "stale";
  return "fresh";
}

function buildJar() {
  process.stdout.write(
    "[preflight] building backend jar (./gradlew bootJar)…\n",
  );
  const res = spawnSync("./gradlew", ["bootJar"], {
    cwd: join(ROOT, "backend"),
    stdio: "inherit",
  });
  return res.status ?? 1;
}

export function main(argv) {
  const checkOnly = argv.includes("--check-only");
  const jarExists = existsSync(JAR);
  const jarMtimeMs = jarExists ? statSync(JAR).mtimeMs : 0;
  const srcMtimeMs = newestMtimeMs(SOURCE_PATHS);
  const mode = resolveMode({ jarExists, jarMtimeMs, srcMtimeMs });

  if (mode === "fresh") {
    process.stdout.write("[preflight] backend jar is up to date.\n");
    return 0;
  }

  const reason = mode === "missing" ? "missing" : "older than backend sources";
  if (checkOnly) {
    process.stderr.write(
      `[preflight] backend jar is ${reason}.\n` +
        "            Run: pnpm run build:backend:jar\n",
    );
    return 1;
  }
  process.stdout.write(`[preflight] backend jar is ${reason}; rebuilding.\n`);
  return buildJar();
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  process.exit(main(process.argv.slice(2)));
}
