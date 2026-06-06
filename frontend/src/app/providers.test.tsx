import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AUTH_SESSION_CHANGED_EVENT } from "@/shared/lib/auth";
import { AppProviders } from "./providers";
import { queryClient, queryClientConfig } from "./queryClient";

beforeEach(() => {
  queryClient.clear();
});

afterEach(() => {
  cleanup();
  queryClient.clear();
});

describe("queryClientConfig", () => {
  it("도메인 팩 변경이 명시적 새로고침 없이 반영되도록 자동 refetch를 활성화한다", () => {
    const queries = queryClientConfig.defaultOptions?.queries;

    expect(queries?.refetchOnWindowFocus).toBe(true);
    expect(queries?.refetchOnMount).toBe(true);
    expect(queries?.refetchOnReconnect).toBe(true);
  });

  it("호출 폭증을 막기 위해 staleTime을 유지하고 mutation 재시도를 끈다", () => {
    const queries = queryClientConfig.defaultOptions?.queries;
    const mutations = queryClientConfig.defaultOptions?.mutations;

    expect(queries?.staleTime).toBe(60 * 1000);
    expect(queries?.retry).toBe(0);
    expect(mutations?.retry).toBe(0);
  });

  it("인증 세션이 바뀌면 이전 계정의 query cache를 정리한다", () => {
    render(
      <AppProviders>
        <div>app</div>
      </AppProviders>,
    );
    queryClient.setQueryData(["workspaces", 1], { id: 1, name: "Previous Workspace" });

    window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));

    expect(queryClient.getQueryData(["workspaces", 1])).toBeUndefined();
  });
});
