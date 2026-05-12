// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveIntentRevisionDraftFlow } from "./useSaveIntentRevisionDraft";

const api = {
  createRevisionDraft: vi.fn(),
  listIntents: vi.fn(),
  updateDraftIntent: vi.fn(),
};

const params = {
  workspaceId: 1,
  packId: 2,
  baseVersionId: 10,
  intentCode: "refund",
  values: { name: "환불 문의", description: "환불 조건 확인" },
};

describe("saveIntentRevisionDraftFlow", () => {
  beforeEach(() => {
    api.createRevisionDraft.mockReset();
    api.listIntents.mockReset();
    api.updateDraftIntent.mockReset();
  });

  it("revision draft 생성 후 같은 intentCode의 cloned intent를 PATCH한다", async () => {
    api.createRevisionDraft.mockResolvedValue({ draftVersionId: 11 });
    api.listIntents.mockResolvedValue([{ id: 20, intentCode: "refund" }]);
    api.updateDraftIntent.mockResolvedValue({ id: 20 });

    await expect(saveIntentRevisionDraftFlow(api, params)).resolves.toEqual({
      draftVersionId: 11,
      clonedIntentId: 20,
      patchSucceeded: true,
    });

    expect(api.createRevisionDraft).toHaveBeenCalledWith(1, 2, 10);
    expect(api.listIntents).toHaveBeenCalledWith(1, 2, 11);
    expect(api.updateDraftIntent).toHaveBeenCalledWith(1, 2, 11, 20, params.values);
  });

  it("cloned intent를 찾지 못하면 PATCH하지 않고 draft 위치를 반환한다", async () => {
    api.createRevisionDraft.mockResolvedValue({ draftVersionId: 11 });
    api.listIntents.mockResolvedValue([{ id: 21, intentCode: "delivery" }]);

    await expect(saveIntentRevisionDraftFlow(api, params)).resolves.toEqual({
      draftVersionId: 11,
      clonedIntentId: null,
      patchSucceeded: false,
    });

    expect(api.updateDraftIntent).not.toHaveBeenCalled();
  });

  it("PATCH 실패 시 생성된 draft와 cloned intent id를 보존한다", async () => {
    api.createRevisionDraft.mockResolvedValue({ draftVersionId: 11 });
    api.listIntents.mockResolvedValue([{ id: 20, intentCode: "refund" }]);
    api.updateDraftIntent.mockRejectedValue(new Error("patch failed"));

    await expect(saveIntentRevisionDraftFlow(api, params)).resolves.toEqual({
      draftVersionId: 11,
      clonedIntentId: 20,
      patchSucceeded: false,
    });
  });
});
