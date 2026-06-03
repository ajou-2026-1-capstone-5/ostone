/// <reference types="node" />
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { request as playwrightRequest } from "@playwright/test";

import { getBaseURL } from "./env";
import { STORAGE_STATE_PATH } from "./global-setup";
import {
  archiveWorkspace,
  CLEANUP_DIR,
  listRegisteredWorkspaces,
  removeFromRegistry,
} from "./support/cleanup-registry";
import type { CreatedWorkspace } from "./support/cleanup-registry";

const LEFTOVERS_LOG = resolve(CLEANUP_DIR, "leftovers.log");

// storageState에서 accessToken을 복원한다. 정리 API 호출에 사용한다.
function readAccessTokenFromStorageState(): string | null {
  if (!existsSync(STORAGE_STATE_PATH)) {
    return null;
  }
  try {
    const state = JSON.parse(readFileSync(STORAGE_STATE_PATH, "utf8")) as {
      origins?: { localStorage?: { name: string; value: string }[] }[];
    };
    for (const origin of state.origins ?? []) {
      for (const item of origin.localStorage ?? []) {
        if (item.name === "accessToken") {
          return item.value;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function globalTeardown(): Promise<void> {
  const leftover = listRegisteredWorkspaces();

  // afterEach 정리가 누락한 잔존 워크스페이스를 저장된 토큰으로 일괄 재정리한다.
  if (leftover.length > 0) {
    const accessToken = readAccessTokenFromStorageState();
    const failed: CreatedWorkspace[] = [];

    if (accessToken) {
      const requestContext = await playwrightRequest.newContext();
      try {
        for (const workspace of leftover) {
          const archived = await archiveWorkspace(requestContext, workspace.id, accessToken);
          if (archived) {
            removeFromRegistry(workspace.id);
          } else {
            failed.push(workspace);
          }
        }
      } finally {
        await requestContext.dispose();
      }
    } else {
      // 토큰을 복원하지 못하면 전부 수동 인계 대상으로 남긴다.
      failed.push(...leftover);
    }

    if (failed.length > 0) {
      const baseURL = getBaseURL();
      const lines = failed.map(
        (w) => `${new Date().toISOString()}\tworkspace\t${w.id}\t${w.label}\t${baseURL}`,
      );
      writeFileSync(LEFTOVERS_LOG, `${lines.join("\n")}\n`, { encoding: "utf8", flag: "a" });
      console.error(
        `[live-e2e] 정리하지 못한 워크스페이스 ${failed.length}건. 운영자 수동 정리 필요: ${failed
          .map((w) => `${w.id}(${w.label})`)
          .join(", ")}. 상세: ${LEFTOVERS_LOG}`,
      );
    }
  }

  // 로그인 토큰이 담긴 임시 storageState를 삭제한다.
  if (existsSync(STORAGE_STATE_PATH)) {
    rmSync(STORAGE_STATE_PATH, { force: true });
  }
}

export default globalTeardown;
