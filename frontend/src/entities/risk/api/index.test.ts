import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { riskApi, riskKeys } from "./index";

describe("riskApi", () => {
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
    expect(riskKeys.list(1, 2, 3)).toEqual(["risks", "list", 1, 2, 3]);
    expect(riskKeys.detail(1, 2, 3, 4)).toEqual(["risks", "detail", 1, 2, 3, 4]);
  });

  it("loads risk list and detail from risk endpoints", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 4 }) });

    await expect(riskApi.list(1, 2, 3)).resolves.toEqual([]);
    await expect(riskApi.detail(1, 2, 3, 4)).resolves.toEqual({ id: 4 });

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "/api/v1/workspaces/1/domain-packs/2/versions/3/risks",
      expect.objectContaining({ method: "GET" }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "/api/v1/workspaces/1/domain-packs/2/versions/3/risks/4",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
