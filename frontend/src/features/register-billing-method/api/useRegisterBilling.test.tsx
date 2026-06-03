import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useRegisterBilling } from "./useRegisterBilling";
import { ApiRequestError } from "@/shared/api";
import { createSubscription } from "@/shared/api/generated/endpoints/subscription-controller/subscription-controller";
import * as loadTossModule from "@/shared/lib/toss/loadToss";

vi.mock(
  "@/shared/api/generated/endpoints/subscription-controller/subscription-controller",
  () => ({
    cancelSubscription: vi.fn(),
    createSubscription: vi.fn(),
    getSubscription: vi.fn(),
    issueBillingKey: vi.fn(),
  }),
);

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/shared/lib/toss/loadToss", () => ({
  TossClientKeyMissingError: class TossClientKeyMissingError extends Error {
    constructor() {
      super("키 누락");
      this.name = "TossClientKeyMissingError";
    }
  },
  loadToss: vi.fn(),
  isTossClientKeyConfigured: vi.fn().mockReturnValue(false),
}));

const mockCreateSubscription = vi.mocked(createSubscription);
const mockLoadToss = vi.mocked(loadTossModule.loadToss);
const mockToastError = vi.mocked(toast.error);
const { TossClientKeyMissingError } = await import("@/shared/lib/toss/loadToss");

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const stubSubscription = { id: 1, workspaceId: 1, status: "INCOMPLETE", customerKey: "ws_1", planKey: "PRO" };

describe("useRegisterBilling", () => {
  beforeEach(() => {
    mockCreateSubscription.mockReset();
    mockLoadToss.mockReset();
    mockToastError.mockReset();
  });

  it("초기 상태 idle", () => {
    const { result } = renderHook(() => useRegisterBilling(), { wrapper: createWrapper() });
    expect(result.current.status).toBe("idle");
  });

  it("TossClientKeyMissingError 시 CLIENT_KEY_MISSING 토스트", async () => {
    mockCreateSubscription.mockResolvedValue({ data: stubSubscription } as never);
    mockLoadToss.mockRejectedValue(new TossClientKeyMissingError());

    const { result } = renderHook(() => useRegisterBilling(), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({ workspaceId: 1, subscription: null });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalled();
  });

  it("USER_CANCEL 에러 시 토스트 없음", async () => {
    const userCancelError = { code: "USER_CANCEL", message: "사용자 취소" };
    mockCreateSubscription.mockResolvedValue({ data: stubSubscription } as never);
    mockLoadToss.mockRejectedValue(userCancelError);

    const { result } = renderHook(() => useRegisterBilling(), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({ workspaceId: 1, subscription: null });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("ApiRequestError SUBSCRIPTION_ALREADY_EXISTS 시 해당 메시지 토스트", async () => {
    mockCreateSubscription.mockRejectedValue(
      new ApiRequestError(409, "SUBSCRIPTION_ALREADY_EXISTS", "이미 존재"),
    );

    const { result } = renderHook(() => useRegisterBilling(), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({ workspaceId: 1, subscription: null });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalled();
  });

  it("ApiRequestError PLAN_NOT_FOUND 시 해당 메시지 토스트", async () => {
    mockCreateSubscription.mockRejectedValue(
      new ApiRequestError(404, "PLAN_NOT_FOUND", "플랜 없음"),
    );

    const { result } = renderHook(() => useRegisterBilling(), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({ workspaceId: 1, subscription: null });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalled();
  });

  it("ApiRequestError WORKSPACE_ACCESS_DENIED 시 해당 메시지 토스트", async () => {
    mockCreateSubscription.mockRejectedValue(
      new ApiRequestError(403, "WORKSPACE_ACCESS_DENIED", "접근 거부"),
    );

    const { result } = renderHook(() => useRegisterBilling(), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({ workspaceId: 1, subscription: null });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalled();
  });

  it("Toss SDK 에러(code+message)는 SDK 메시지로 토스트", async () => {
    const sdkError = { code: "SDK_ERROR", message: "잘못된 클라이언트 키입니다." };
    mockCreateSubscription.mockResolvedValue({ data: stubSubscription } as never);
    mockLoadToss.mockRejectedValue(sdkError);

    const { result } = renderHook(() => useRegisterBilling(), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({ workspaceId: 1, subscription: null });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalledWith("잘못된 클라이언트 키입니다.");
  });

  it("subscription 이미 있으면 createSubscription 미호출", async () => {
    const tossPaymentMock = {
      requestBillingAuth: vi.fn().mockResolvedValue({}),
    };
    const tossMock = {
      payment: vi.fn().mockReturnValue(tossPaymentMock),
    };
    mockLoadToss.mockResolvedValue(tossMock as never);

    const existingSubscription = { ...stubSubscription, status: "ACTIVE" };
    const { result } = renderHook(() => useRegisterBilling(), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({ workspaceId: 1, subscription: existingSubscription as never });
    });
    await waitFor(() => !result.current.isPending);
    expect(mockCreateSubscription).not.toHaveBeenCalled();
    expect(tossPaymentMock.requestBillingAuth).toHaveBeenCalled();
  });

  it("미처리 ApiRequestError는 REGISTER_FAILED 토스트 (line 39 path)", async () => {
    mockCreateSubscription.mockRejectedValue(
      new ApiRequestError(500, "SOME_UNKNOWN_CODE", "알 수 없는 서버 오류"),
    );

    const { result } = renderHook(() => useRegisterBilling(), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({ workspaceId: 1, subscription: null });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalled();
  });

  it("일반 Error는 REGISTER_FAILED 토스트 (line 51 path)", async () => {
    mockCreateSubscription.mockRejectedValue(new Error("plain network error"));

    const { result } = renderHook(() => useRegisterBilling(), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({ workspaceId: 1, subscription: null });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalled();
  });

  it("빈 message인 Toss SDK 에러는 REGISTER_FAILED 토스트", async () => {
    const sdkError = { code: "ERR", message: "  " };
    mockCreateSubscription.mockResolvedValue({ data: stubSubscription } as never);
    mockLoadToss.mockRejectedValue(sdkError);

    const { result } = renderHook(() => useRegisterBilling(), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({ workspaceId: 1, subscription: null });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalled();
  });
});
