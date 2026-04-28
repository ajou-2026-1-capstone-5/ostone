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

  it("updates risk fields and status through risk endpoints", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 4 }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 4, status: "INACTIVE" }),
      });

    await expect(
      riskApi.update(1, 2, 3, 4, {
        name: "사기 위험",
        riskLevel: "HIGH",
        triggerConditionJson: "{}",
        handlingActionJson: "{}",
        evidenceJson: "[]",
        metaJson: "{}",
      }),
    ).resolves.toEqual({ id: 4 });
    await expect(riskApi.updateStatus(1, 2, 3, 4, { status: "INACTIVE" })).resolves.toEqual({
      id: 4,
      status: "INACTIVE",
    });

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "/api/v1/workspaces/1/domain-packs/2/versions/3/risks/4",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "/api/v1/workspaces/1/domain-packs/2/versions/3/risks/4/status",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("propagates non-ok list responses from the risk list endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ code: "RISK_DEFINITION_NOT_FOUND", message: "Not found" }),
    });

    await expect(riskApi.list(1, 2, 3)).rejects.toMatchObject({
      status: 404,
      code: "RISK_DEFINITION_NOT_FOUND",
      message: "Not found",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/1/domain-packs/2/versions/3/risks",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("propagates network failures from the risk detail endpoint", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));

    await expect(riskApi.detail(1, 2, 3, 4)).rejects.toThrow("network error");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/1/domain-packs/2/versions/3/risks/4",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
