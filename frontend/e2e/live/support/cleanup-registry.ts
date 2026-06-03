/// <reference types="node" />
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { APIRequestContext } from "@playwright/test";

import { getBaseURL } from "../env";

// 라이브 스모크가 운영에 생성한 워크스페이스를 추적/정리하기 위한 레지스트리.
// afterEach에서 즉시 정리하고, 누락분은 globalTeardown이 재정리하는 2중 구조를 지원한다.

const LIVE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLEANUP_DIR = resolve(LIVE_ROOT, ".cleanup");
const REGISTRY_FILE = resolve(CLEANUP_DIR, "created.json");

export interface CreatedWorkspace {
  readonly id: number;
  readonly label: string;
  readonly createdAt: string;
}

interface RegistryShape {
  readonly workspaces: readonly CreatedWorkspace[];
}

function ensureDir(): void {
  if (!existsSync(CLEANUP_DIR)) {
    mkdirSync(CLEANUP_DIR, { recursive: true });
  }
}

function readRegistry(): RegistryShape {
  if (!existsSync(REGISTRY_FILE)) {
    return { workspaces: [] };
  }
  try {
    const parsed = JSON.parse(readFileSync(REGISTRY_FILE, "utf8")) as Partial<RegistryShape>;
    return { workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : [] };
  } catch {
    // 손상된 레지스트리는 빈 상태로 취급한다. 잔존 리소스는 leftovers 로그가 보완한다.
    return { workspaces: [] };
  }
}

function writeRegistry(registry: RegistryShape): void {
  ensureDir();
  writeFileSync(REGISTRY_FILE, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

// 동기 read-modify-write로 append한다. live config는 workers:1, fullyParallel:false라
// 동시 쓰기 경합이 없으므로 별도 파일 락은 두지 않는다.
export function registerWorkspace(id: number, label: string): void {
  const registry = readRegistry();
  if (registry.workspaces.some((w) => w.id === id)) {
    return;
  }
  writeRegistry({
    workspaces: [...registry.workspaces, { id, label, createdAt: new Date().toISOString() }],
  });
}

export function removeFromRegistry(id: number): void {
  const registry = readRegistry();
  writeRegistry({ workspaces: registry.workspaces.filter((w) => w.id !== id) });
}

export function listRegisteredWorkspaces(): readonly CreatedWorkspace[] {
  return readRegistry().workspaces;
}

// 워크스페이스 논리삭제 API를 호출한다. 성공 여부를 boolean으로 반환해
// 호출자가 leftovers 처리 여부를 판단하게 한다.
export async function archiveWorkspace(
  request: APIRequestContext,
  id: number,
  accessToken: string,
): Promise<boolean> {
  const response = await request.delete(`${getBaseURL()}/api/v1/workspaces/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.ok();
}

export { CLEANUP_DIR, REGISTRY_FILE };
