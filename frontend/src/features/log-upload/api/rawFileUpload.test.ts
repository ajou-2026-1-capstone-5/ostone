import { beforeEach, describe, expect, it, vi } from "vitest";

import { completeRawFileUpload, initRawFileUpload } from "./rawFileUpload";

vi.mock("@/shared/api", () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

import { apiClient } from "@/shared/api";

const mockPost = vi.mocked(apiClient.post);

const initRequest = {
  datasetKey: "key-1",
  name: "logs.zip",
  sourceType: "RAW",
  filename: "logs.zip",
  contentType: "application/zip",
  sizeBytes: 1024,
} as const;

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

describe("initRawFileUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("올바른 URL과 요청 body로 apiClient.post를 호출한다", async () => {
    mockPost.mockResolvedValueOnce(initResponse);

    await initRawFileUpload(1, initRequest);

    expect(mockPost).toHaveBeenCalledWith("/workspaces/1/datasets/uploads:init", initRequest);
  });

  it("성공 응답으로 InitRawFileUploadResponse를 반환한다", async () => {
    mockPost.mockResolvedValueOnce(initResponse);

    const result = await initRawFileUpload(1, initRequest);

    expect(result).toEqual(initResponse);
  });

  it("workspaceId가 URL 경로에 포함된다", async () => {
    mockPost.mockResolvedValueOnce(initResponse);

    await initRawFileUpload(99, initRequest);

    expect(mockPost).toHaveBeenCalledWith("/workspaces/99/datasets/uploads:init", initRequest);
  });

  it("apiClient.post가 reject하면 에러를 전파한다", async () => {
    const error = new Error("서버 오류");
    mockPost.mockRejectedValueOnce(error);

    await expect(initRawFileUpload(1, initRequest)).rejects.toThrow("서버 오류");
  });
});

describe("completeRawFileUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("올바른 URL로 apiClient.post를 호출한다", async () => {
    mockPost.mockResolvedValueOnce(completeResponse);

    await completeRawFileUpload(1, 42);

    expect(mockPost).toHaveBeenCalledWith(
      "/workspaces/1/datasets/uploads/42:complete",
      undefined,
    );
  });

  it("성공 응답으로 CompleteRawFileUploadResponse를 반환한다", async () => {
    mockPost.mockResolvedValueOnce(completeResponse);

    const result = await completeRawFileUpload(1, 42);

    expect(result).toEqual(completeResponse);
  });

  it("workspaceId와 datasetId가 URL 경로에 포함된다", async () => {
    mockPost.mockResolvedValueOnce(completeResponse);

    await completeRawFileUpload(7, 99);

    expect(mockPost).toHaveBeenCalledWith(
      "/workspaces/7/datasets/uploads/99:complete",
      undefined,
    );
  });

  it("apiClient.post가 reject하면 에러를 전파한다", async () => {
    const error = new Error("완료 처리 실패");
    mockPost.mockRejectedValueOnce(error);

    await expect(completeRawFileUpload(1, 42)).rejects.toThrow("완료 처리 실패");
  });
});
