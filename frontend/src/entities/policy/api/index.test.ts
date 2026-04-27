import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { policyApi, policyKeys } from "./index";

describe("policyApi", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses stable query keys for list and detail", () => {
    expect(policyKeys.list(1, 2, 3)).toEqual(["policies", "list", 1, 2, 3]);
    expect(policyKeys.detail(1, 2, 3, 4)).toEqual(["policies", "detail", 1, 2, 3, 4]);
  });

  it("loads policy list and detail from policy endpoints", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 4 }) });

    await expect(policyApi.list(1, 2, 3)).resolves.toEqual([]);
    await expect(policyApi.detail(1, 2, 3, 4)).resolves.toEqual({ id: 4 });

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "/api/v1/workspaces/1/domain-packs/2/versions/3/policies",
      expect.objectContaining({ method: "GET" }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "/api/v1/workspaces/1/domain-packs/2/versions/3/policies/4",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("updates policy body and status through patch endpoints", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 4 }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 4 }) });

    await policyApi.update(1, 2, 3, 4, { name: "새 정책" });
    await policyApi.updateStatus(1, 2, 3, 4, { status: "INACTIVE" });

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "/api/v1/workspaces/1/domain-packs/2/versions/3/policies/4",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ name: "새 정책" }),
      }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "/api/v1/workspaces/1/domain-packs/2/versions/3/policies/4/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "INACTIVE" }),
      }),
    );
  });
});
