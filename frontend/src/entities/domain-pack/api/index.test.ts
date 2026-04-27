import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { domainPackApi } from "./index";

describe("domainPackApi", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads latest draft entry for a workspace", async () => {
    const response = { workspaceId: 1, packId: 2, versionId: 3, packName: "CS", versionNo: 4 };
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => response });

    await expect(domainPackApi.getDraftEntry(1)).resolves.toEqual(response);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/1/domain-packs/draft-entry",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
