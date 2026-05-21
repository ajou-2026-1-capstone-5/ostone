// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/shared/api";
import { intentRevisionDraftApi } from "./intentRevisionDraftApi";

vi.mock("@/shared/api", () => ({
  apiClient: {
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
  },
}));

const mockedPost = vi.mocked(apiClient.post);
const mockedPatch = vi.mocked(apiClient.patch);
const mockedDelete = vi.mocked(apiClient.delete);
const mockedGet = vi.mocked(apiClient.get);
const mockedWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

describe("intentRevisionDraftApi", () => {
  beforeEach(() => {
    mockedPost.mockReset();
    mockedPatch.mockReset();
    mockedDelete.mockReset();
    mockedGet.mockReset();
    mockedWarn.mockClear();
  });

  it("revision draft 생성 응답의 canonical draftVersionId를 정규화한다", async () => {
    mockedPost.mockResolvedValue({ draftVersionId: 15 });

    await expect(intentRevisionDraftApi.createRevisionDraft(1, 2, 12)).resolves.toEqual({
      draftVersionId: 15,
    });
    expect(mockedWarn).not.toHaveBeenCalled();
    expect(mockedPost).toHaveBeenCalledWith(
      "/workspaces/1/domain-packs/2/versions/12/revision-drafts",
      undefined,
    );
  });

  it("revision draft 생성 응답의 legacy draftVersion.versionId를 warning과 함께 정규화한다", async () => {
    mockedPost.mockResolvedValue({
      draftVersion: { versionId: 15, versionNo: 5, lifecycleStatus: "DRAFT" },
    });

    await expect(intentRevisionDraftApi.createRevisionDraft(1, 2, 12)).resolves.toEqual({
      draftVersionId: 15,
    });
    expect(mockedPost).toHaveBeenCalledWith(
      "/workspaces/1/domain-packs/2/versions/12/revision-drafts",
      undefined,
    );
    expect(mockedWarn).toHaveBeenCalledWith(
      "[intentRevisionDraftApi] using legacy revision draft id response field",
    );
  });

  it("activate 응답의 id를 activatedVersionId로 정규화한다", async () => {
    mockedPost.mockResolvedValue({
      id: 16,
      domainPackId: 2,
      lifecycleStatus: "PUBLISHED",
    });

    await expect(intentRevisionDraftApi.activateVersion(1, 2, 15)).resolves.toEqual({
      activatedVersionId: 16,
    });
    expect(mockedPost).toHaveBeenCalledWith(
      "/workspaces/1/domain-packs/2/versions/15/activate",
      undefined,
    );
  });

  it("data wrapper가 있는 list/detail 응답을 unwrap한다", async () => {
    mockedGet.mockResolvedValueOnce({ data: [{ id: 1, intentCode: "refund" }] });
    mockedGet.mockResolvedValueOnce({ data: { id: 1, intentCode: "refund", name: "환불" } });

    await expect(intentRevisionDraftApi.listIntents(1, 2, 3)).resolves.toEqual([
      { id: 1, intentCode: "refund" },
    ]);
    await expect(intentRevisionDraftApi.getIntent(1, 2, 3, 1)).resolves.toMatchObject({
      id: 1,
      intentCode: "refund",
    });
  });

  it("draft intent PATCH와 discard 경로를 고정한다", async () => {
    mockedPatch.mockResolvedValue({ id: 7, intentCode: "refund" });
    mockedDelete.mockResolvedValue(undefined);

    await intentRevisionDraftApi.updateDraftIntent(1, 2, 3, 7, {
      name: "환불 문의",
      description: "",
    });
    await intentRevisionDraftApi.discardDraft(1, 2, 3);

    expect(mockedPatch).toHaveBeenCalledWith("/workspaces/1/domain-packs/2/versions/3/intents/7", {
      name: "환불 문의",
      description: "",
    });
    expect(mockedDelete).toHaveBeenCalledWith("/workspaces/1/domain-packs/2/versions/3/draft");
  });
});
