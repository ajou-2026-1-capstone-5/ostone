import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { intentRevisionDraftApi } from "../api/intentRevisionDraftApi";
import { useUpdateDraftIntent } from "./useUpdateDraftIntent";

vi.mock("../api/intentRevisionDraftApi", () => ({
  intentRevisionDraftApi: {
    updateDraftIntent: vi.fn(),
  },
}));

const mockedUpdateDraftIntent = vi.mocked(intentRevisionDraftApi.updateDraftIntent);

describe("useUpdateDraftIntent", () => {
  beforeEach(() => {
    mockedUpdateDraftIntent.mockReset();
  });

  it("draft intent PATCH를 호출하고 pending 상태를 복구한다", async () => {
    mockedUpdateDraftIntent.mockResolvedValue({ id: 10, intentCode: "refund" } as never);
    const { result } = renderHook(() => useUpdateDraftIntent());

    let promise: Promise<unknown>;
    act(() => {
      promise = result.current.updateDraftIntent({
        workspaceId: 1,
        packId: 2,
        draftVersionId: 3,
        intentId: 10,
        values: { name: "환불 문의", description: "설명" },
      });
    });

    expect(result.current.isPending).toBe(true);
    await expect(promise!).resolves.toMatchObject({ id: 10 });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(mockedUpdateDraftIntent).toHaveBeenCalledWith(1, 2, 3, 10, {
      name: "환불 문의",
      description: "설명",
    });
  });

  it("PATCH 실패를 caller에게 전달하면서 pending 상태를 복구한다", async () => {
    mockedUpdateDraftIntent.mockRejectedValue(new Error("patch failed"));
    const { result } = renderHook(() => useUpdateDraftIntent());

    let promise: Promise<unknown>;
    act(() => {
      promise = result.current.updateDraftIntent({
        workspaceId: 1,
        packId: 2,
        draftVersionId: 3,
        intentId: 10,
        values: { name: "환불 문의", description: "설명" },
      });
    });

    await expect(promise!).rejects.toThrow("patch failed");
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });
});
