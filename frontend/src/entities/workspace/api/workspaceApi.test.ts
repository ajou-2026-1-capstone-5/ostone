import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { workspaceApi } from "./workspaceApi";

describe("workspaceApi", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  it("lists workspaces from the existing workspace endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    await expect(workspaceApi.list()).resolves.toEqual([]);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/workspaces",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("creates a workspace with generated key and name payload", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 1 }),
    });

    await workspaceApi.create({ workspaceKey: "cs-team-alpha-abc123", name: "CS Team Alpha" });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/workspaces",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          workspaceKey: "cs-team-alpha-abc123",
          name: "CS Team Alpha",
        }),
      }),
    );
  });

  it("updates and archives a workspace through existing endpoints", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 1 }) })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => undefined });

    await workspaceApi.update(1, { name: "Renamed" });
    await workspaceApi.archive(1);

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "/api/v1/workspaces/1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ name: "Renamed" }),
      }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "/api/v1/workspaces/1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
