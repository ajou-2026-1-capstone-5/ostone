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
