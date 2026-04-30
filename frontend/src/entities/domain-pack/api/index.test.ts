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

  it("fetches domain pack detail by wsId and packId", async () => {
    const response = { packId: 2, workspaceId: 1, code: "CS", name: "고객지원", versions: [] };
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => response });

    await expect(domainPackApi.detail(1, 2)).resolves.toEqual(response);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/1/domain-packs/2",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("fetches domain pack version detail by wsId, packId and versionId", async () => {
    const response = { versionId: 3, packId: 2, versionNo: 1, lifecycleStatus: "DRAFT" };
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => response });

    await expect(domainPackApi.versionDetail(1, 2, 3)).resolves.toEqual(response);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/1/domain-packs/2/versions/3",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
