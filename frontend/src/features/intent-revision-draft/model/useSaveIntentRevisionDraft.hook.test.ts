import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { intentRevisionDraftApi } from "../api/intentRevisionDraftApi";
import { useSaveIntentRevisionDraft } from "./useSaveIntentRevisionDraft";

vi.mock("../api/intentRevisionDraftApi", () => ({
  intentRevisionDraftApi: {
    createRevisionDraft: vi.fn(),
    listIntents: vi.fn(),
    updateDraftIntent: vi.fn(),
  },
}));

const mockedApi = vi.mocked(intentRevisionDraftApi);

describe("useSaveIntentRevisionDraft", () => {
  beforeEach(() => {
    mockedApi.createRevisionDraft.mockReset();
    mockedApi.listIntents.mockReset();
    mockedApi.updateDraftIntent.mockReset();
  });

  it("revision draft 저장 flow를 실행하고 pending 상태를 복구한다", async () => {
    mockedApi.createRevisionDraft.mockResolvedValue({ draftVersionId: 4 });
    mockedApi.listIntents.mockResolvedValue([{ id: 40, intentCode: "refund" }] as never);
    mockedApi.updateDraftIntent.mockResolvedValue({ id: 40 } as never);
    const { result } = renderHook(() => useSaveIntentRevisionDraft());

    let promise: Promise<unknown>;
    act(() => {
      promise = result.current.saveIntentRevisionDraft({
        workspaceId: 1,
        packId: 2,
        baseVersionId: 3,
        intentCode: "refund",
        values: { name: "환불 문의", description: "설명" },
      });
    });

    expect(result.current.isPending).toBe(true);
    await expect(promise!).resolves.toEqual({
      draftVersionId: 4,
      clonedIntentId: 40,
      patchSucceeded: true,
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });
});
