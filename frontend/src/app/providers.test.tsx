import { describe, expect, it } from "vitest";
import { queryClientConfig } from "./queryClient";

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
});
