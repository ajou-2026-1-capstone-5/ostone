import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PresignedUploadAbortError,
  PresignedUploadError,
} from "@/shared/lib/presignedUpload";

vi.mock("@/shared/lib/presignedUpload", () => ({
  putPresignedFile: vi.fn(),
  PresignedUploadAbortError: class PresignedUploadAbortError extends Error {
    constructor() {
      super("업로드가 취소되었습니다.");
      this.name = "PresignedUploadAbortError";
    }
  },
  PresignedUploadError: class PresignedUploadError extends Error {
    readonly status: number | null;
    constructor(message: string, status: number | null) {
      super(message);
      this.name = "PresignedUploadError";
      this.status = status;
    }
  },
}));

vi.mock("../api/rawFileUpload", () => ({
  initRawFileUpload: vi.fn(),
  completeRawFileUpload: vi.fn(),
}));

import { putPresignedFile } from "@/shared/lib/presignedUpload";
import { completeRawFileUpload, initRawFileUpload } from "../api/rawFileUpload";
import { useRawFileUpload } from "./useRawFileUpload";

const mockPut = vi.mocked(putPresignedFile);
const mockInit = vi.mocked(initRawFileUpload);
const mockComplete = vi.mocked(completeRawFileUpload);

const makeFile = (name = "logs.zip", type = "application/zip") =>
  new File(["PK"], name, { type });

const initResponse = {
  datasetId: 42,
  datasetKey: "key-1",
  workspaceId: 1,
  uploadUrl: "https://s3.example.com/presigned",
  objectKey: "datasets/42/logs.zip",
  contentType: "application/zip",
  expiresInSeconds: 900,
  serverSideEncryptionRequired: false,
};

const completeResponse = {
  datasetId: 42,
  datasetKey: "key-1",
  workspaceId: 1,
  objectKey: "datasets/42/logs.zip",
  sizeBytes: 1024,
  status: "READY",
};

describe("useRawFileUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("초기 상태는 isUploading=false, progress=0이다", () => {
    const { result } = renderHook(() => useRawFileUpload());

    expect(result.current.isUploading).toBe(false);
    expect(result.current.progress).toBe(0);
  });

  it("init→PUT→complete 정상 흐름에서 onSuccess가 호출된다", async () => {
    mockInit.mockResolvedValueOnce(initResponse);
    mockPut.mockResolvedValueOnce(undefined);
    mockComplete.mockResolvedValueOnce(completeResponse);

    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useRawFileUpload());

    await act(async () => {
      await result.current.start({
        workspaceId: 1,
        file: makeFile(),
        onSuccess,
        onError,
      });
    });

    expect(onSuccess).toHaveBeenCalledWith(completeResponse);
    expect(onError).not.toHaveBeenCalled();
    expect(result.current.isUploading).toBe(false);
    expect(result.current.progress).toBe(100);
  });

  it("업로드 중 isUploading이 true로 설정된다", async () => {
    let resolveInit!: (v: typeof initResponse) => void;
    mockInit.mockReturnValueOnce(
      new Promise<typeof initResponse>((res) => {
        resolveInit = res;
      }),
    );

    const { result } = renderHook(() => useRawFileUpload());

    act(() => {
      result.current.start({
        workspaceId: 1,
        file: makeFile(),
        onSuccess: vi.fn(),
        onError: vi.fn(),
      });
    });

    expect(result.current.isUploading).toBe(true);
    expect(result.current.progress).toBe(0);

    // 남은 단계 완료
    mockPut.mockResolvedValueOnce(undefined);
    mockComplete.mockResolvedValueOnce(completeResponse);
    await act(async () => {
      resolveInit(initResponse);
    });
  });

  it("업로드 진행 중 start를 다시 호출하면 새 요청을 만들지 않고 거절한다", async () => {
    let resolveInit!: (v: typeof initResponse) => void;
    mockInit.mockReturnValueOnce(
      new Promise<typeof initResponse>((res) => {
        resolveInit = res;
      }),
    );

    const firstOnError = vi.fn();
    const duplicateOnError = vi.fn();
    const { result } = renderHook(() => useRawFileUpload());

    let uploadPromise: Promise<void> = Promise.resolve();
    act(() => {
      uploadPromise = result.current.start({
        workspaceId: 1,
        file: makeFile(),
        onSuccess: vi.fn(),
        onError: firstOnError,
      });
    });

    await act(async () => {
      await result.current.start({
        workspaceId: 1,
        file: makeFile("retry.zip"),
        onSuccess: vi.fn(),
        onError: duplicateOnError,
      });
    });

    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(duplicateOnError).toHaveBeenCalledWith("이미 업로드가 진행 중입니다.");
    expect(firstOnError).not.toHaveBeenCalled();
    expect(result.current.isUploading).toBe(true);

    mockPut.mockResolvedValueOnce(undefined);
    mockComplete.mockResolvedValueOnce(completeResponse);
    await act(async () => {
      resolveInit(initResponse);
      await uploadPromise;
    });
  });

  it("중복 start 거절 후 cancel은 기존 업로드 controller를 abort한다", async () => {
    let capturedSignal: AbortSignal | undefined;
    mockInit.mockResolvedValueOnce(initResponse);
    mockPut.mockImplementationOnce(async ({ signal }) => {
      capturedSignal = signal;
      await new Promise<void>((_, reject) => {
        signal?.addEventListener("abort", () => reject(new PresignedUploadAbortError()));
      });
    });

    const duplicateOnError = vi.fn();
    const { result } = renderHook(() => useRawFileUpload());

    let uploadPromise: Promise<void> = Promise.resolve();
    act(() => {
      uploadPromise = result.current.start({
        workspaceId: 1,
        file: makeFile(),
        onSuccess: vi.fn(),
        onError: vi.fn(),
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.start({
        workspaceId: 1,
        file: makeFile("retry.zip"),
        onSuccess: vi.fn(),
        onError: duplicateOnError,
      });
    });

    act(() => {
      result.current.cancel();
    });

    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(duplicateOnError).toHaveBeenCalledWith("이미 업로드가 진행 중입니다.");
    expect(capturedSignal?.aborted).toBe(true);

    await act(async () => {
      await uploadPromise;
    });
  });

  it("이전 업로드 cleanup은 reset 후 새 업로드 controller를 지우지 않는다", async () => {
    let rejectFirstUpload!: (reason?: unknown) => void;
    let secondSignal: AbortSignal | undefined;
    let resolveFirstPutStarted!: () => void;
    let resolveSecondPutStarted!: () => void;
    const firstPutStarted = new Promise<void>((resolve) => {
      resolveFirstPutStarted = resolve;
    });
    const secondPutStarted = new Promise<void>((resolve) => {
      resolveSecondPutStarted = resolve;
    });

    mockInit.mockResolvedValueOnce(initResponse).mockResolvedValueOnce({
      ...initResponse,
      datasetId: 43,
    });
    mockPut
      .mockImplementationOnce(async () => {
        resolveFirstPutStarted();
        await new Promise<void>((_, reject) => {
          rejectFirstUpload = reject;
        });
      })
      .mockImplementationOnce(async ({ signal }) => {
        secondSignal = signal;
        resolveSecondPutStarted();
        await new Promise<void>((_, reject) => {
          signal?.addEventListener("abort", () => reject(new PresignedUploadAbortError()));
        });
      });

    const { result } = renderHook(() => useRawFileUpload());

    let firstUploadPromise: Promise<void> = Promise.resolve();
    act(() => {
      firstUploadPromise = result.current.start({
        workspaceId: 1,
        file: makeFile(),
        onSuccess: vi.fn(),
        onError: vi.fn(),
      });
    });

    await act(async () => {
      await firstPutStarted;
    });

    act(() => {
      result.current.reset();
    });

    let secondUploadPromise: Promise<void> = Promise.resolve();
    act(() => {
      secondUploadPromise = result.current.start({
        workspaceId: 1,
        file: makeFile("next.zip"),
        onSuccess: vi.fn(),
        onError: vi.fn(),
      });
    });

    await act(async () => {
      await secondPutStarted;
    });

    await act(async () => {
      rejectFirstUpload(new PresignedUploadAbortError());
      await firstUploadPromise;
    });

    expect(result.current.isUploading).toBe(true);

    act(() => {
      result.current.cancel();
    });

    expect(secondSignal?.aborted).toBe(true);

    await act(async () => {
      await secondUploadPromise;
    });
  });

  it("putPresignedFile의 onProgress 콜백으로 progress가 갱신된다", async () => {
    let continueUpload!: () => void;
    let finishUpload!: () => void;
    mockInit.mockResolvedValueOnce(initResponse);
    mockPut.mockImplementationOnce(async ({ onProgress }) => {
      onProgress?.(40);
      await new Promise<void>((resolve) => {
        continueUpload = resolve;
      });
      onProgress?.(80);
      await new Promise<void>((resolve) => {
        finishUpload = resolve;
      });
    });
    mockComplete.mockResolvedValueOnce(completeResponse);

    const { result } = renderHook(() => useRawFileUpload());

    let uploadPromise: Promise<void> = Promise.resolve();
    act(() => {
      uploadPromise = result.current.start({
        workspaceId: 1,
        file: makeFile(),
        onSuccess: vi.fn(),
        onError: vi.fn(),
      });
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.progress).toBe(40);

    await act(async () => {
      continueUpload();
      await Promise.resolve();
    });
    expect(result.current.progress).toBe(80);

    await act(async () => {
      finishUpload();
      await uploadPromise;
    });
    expect(result.current.progress).toBe(100);
  });

  it("init 단계 실패 시 onError가 에러 메시지와 함께 호출된다", async () => {
    mockInit.mockRejectedValueOnce(new Error("초기화 실패"));

    const onError = vi.fn();
    const { result } = renderHook(() => useRawFileUpload());

    await act(async () => {
      await result.current.start({
        workspaceId: 1,
        file: makeFile(),
        onSuccess: vi.fn(),
        onError,
      });
    });

    expect(onError).toHaveBeenCalledWith("초기화 실패");
    expect(result.current.isUploading).toBe(false);
  });

  it("init 단계 실패 시 메시지 없으면 fallback 메시지를 사용한다", async () => {
    mockInit.mockRejectedValueOnce("unknown error");

    const onError = vi.fn();
    const { result } = renderHook(() => useRawFileUpload());

    await act(async () => {
      await result.current.start({
        workspaceId: 1,
        file: makeFile(),
        onSuccess: vi.fn(),
        onError,
      });
    });

    expect(onError).toHaveBeenCalledWith("업로드 준비에 실패했습니다.");
  });

  it("transfer 단계 실패 시 onError가 에러 메시지와 함께 호출된다", async () => {
    mockInit.mockResolvedValueOnce(initResponse);
    mockPut.mockRejectedValueOnce(new PresignedUploadError("S3 거부", 403));

    const onError = vi.fn();
    const { result } = renderHook(() => useRawFileUpload());

    await act(async () => {
      await result.current.start({
        workspaceId: 1,
        file: makeFile(),
        onSuccess: vi.fn(),
        onError,
      });
    });

    expect(onError).toHaveBeenCalledWith("S3 거부");
  });

  it("complete 단계 실패 시 onError가 에러 메시지와 함께 호출된다", async () => {
    mockInit.mockResolvedValueOnce(initResponse);
    mockPut.mockResolvedValueOnce(undefined);
    mockComplete.mockRejectedValueOnce(new Error("완료 처리 실패"));

    const onError = vi.fn();
    const { result } = renderHook(() => useRawFileUpload());

    await act(async () => {
      await result.current.start({
        workspaceId: 1,
        file: makeFile(),
        onSuccess: vi.fn(),
        onError,
      });
    });

    expect(onError).toHaveBeenCalledWith("완료 처리 실패");
  });

  it("PresignedUploadAbortError는 onError를 호출하지 않는다", async () => {
    mockInit.mockResolvedValueOnce(initResponse);
    mockPut.mockRejectedValueOnce(new PresignedUploadAbortError());

    const onError = vi.fn();
    const { result } = renderHook(() => useRawFileUpload());

    await act(async () => {
      await result.current.start({
        workspaceId: 1,
        file: makeFile(),
        onSuccess: vi.fn(),
        onError,
      });
    });

    expect(onError).not.toHaveBeenCalled();
    expect(result.current.isUploading).toBe(false);
  });

  it("cancel() 호출 시 AbortController가 abort된다", async () => {
    let capturedSignal: AbortSignal | undefined;
    mockInit.mockResolvedValueOnce(initResponse);
    mockPut.mockImplementationOnce(async ({ signal }) => {
      capturedSignal = signal;
      // 취소될 때까지 대기
      await new Promise<void>((_, reject) => {
        signal?.addEventListener("abort", () => reject(new PresignedUploadAbortError()));
      });
    });

    const { result } = renderHook(() => useRawFileUpload());

    act(() => {
      result.current.start({
        workspaceId: 1,
        file: makeFile(),
        onSuccess: vi.fn(),
        onError: vi.fn(),
      });
    });

    await act(async () => {
      // init이 resolve될 때까지 tick
      await Promise.resolve();
    });

    act(() => {
      result.current.cancel();
    });

    expect(capturedSignal?.aborted).toBe(true);
  });

  it("reset() 호출 시 상태가 초기화된다", async () => {
    mockInit.mockResolvedValueOnce(initResponse);
    mockPut.mockResolvedValueOnce(undefined);
    mockComplete.mockResolvedValueOnce(completeResponse);

    const { result } = renderHook(() => useRawFileUpload());

    await act(async () => {
      await result.current.start({
        workspaceId: 1,
        file: makeFile(),
        onSuccess: vi.fn(),
        onError: vi.fn(),
      });
    });

    expect(result.current.progress).toBe(100);

    act(() => {
      result.current.reset();
    });

    expect(result.current.isUploading).toBe(false);
    expect(result.current.progress).toBe(0);
  });

  it("application/zip 이외의 ZIP MIME은 application/zip으로 보정하여 initRawFileUpload에 전달한다", async () => {
    mockInit.mockResolvedValueOnce(initResponse);
    mockPut.mockResolvedValueOnce(undefined);
    mockComplete.mockResolvedValueOnce(completeResponse);

    const { result } = renderHook(() => useRawFileUpload());

    await act(async () => {
      await result.current.start({
        workspaceId: 1,
        file: makeFile("logs.zip", "application/octet-stream"),
        onSuccess: vi.fn(),
        onError: vi.fn(),
      });
    });

    expect(mockInit).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ contentType: "application/zip" }),
    );
  });

  it("application/x-zip-compressed은 그대로 initRawFileUpload에 전달한다", async () => {
    mockInit.mockResolvedValueOnce(initResponse);
    mockPut.mockResolvedValueOnce(undefined);
    mockComplete.mockResolvedValueOnce(completeResponse);

    const { result } = renderHook(() => useRawFileUpload());

    await act(async () => {
      await result.current.start({
        workspaceId: 1,
        file: makeFile("logs.zip", "application/x-zip-compressed"),
        onSuccess: vi.fn(),
        onError: vi.fn(),
      });
    });

    expect(mockInit).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ contentType: "application/x-zip-compressed" }),
    );
  });
});
