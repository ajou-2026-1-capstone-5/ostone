import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useApproveIntent } from "./useApproveIntent";

const mockMutate = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock("@/shared/api/generated/endpoints/update-intent-status-controller/update-intent-status-controller", () => ({
  useUpdateIntentStatus: () => ({
    mutate: mockMutate,
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useApproveIntent", () => {
  beforeEach(() => {
    mockMutate.mockReset();
    mockMutateAsync.mockReset();
  });

  it("mutate('PUBLISHED') 호출 시 generated mutation에 올바른 variables 전달", () => {
    const { result } = renderHook(() =>
      useApproveIntent({ wsId: 1, packId: 2, versionId: 3, intentId: 4 })
    );

    act(() => { result.current.mutate("PUBLISHED"); });

    expect(mockMutate).toHaveBeenCalledWith(
      { workspaceId: 1, packId: 2, versionId: 3, intentId: 4, data: { status: "PUBLISHED" } },
      expect.objectContaining({
        onSuccess: expect.any(Function),
      })
    );
  });

  it("mutate 성공 시 onStatusChanged 콜백 호출", () => {
    const onStatusChanged = vi.fn();
    const { result } = renderHook(() =>
      useApproveIntent({ wsId: 1, packId: 2, versionId: 3, intentId: 4, onStatusChanged })
    );

    act(() => { result.current.mutate("PUBLISHED"); });

    const callArgs = mockMutate.mock.calls[0];
    const options = callArgs[1];
    options.onSuccess();

    expect(onStatusChanged).toHaveBeenCalledWith("PUBLISHED");
  });

  it("mutateAsync('REJECTED')를 호출할 수 있다", async () => {
    mockMutateAsync.mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useApproveIntent({ wsId: 1, packId: 2, versionId: 3, intentId: 5 })
    );

    await act(async () => {
      await result.current.mutateAsync("REJECTED");
    });

    expect(mockMutateAsync).toHaveBeenCalledWith(
      { workspaceId: 1, packId: 2, versionId: 3, intentId: 5, data: { status: "REJECTED" } },
    );
  });
});
