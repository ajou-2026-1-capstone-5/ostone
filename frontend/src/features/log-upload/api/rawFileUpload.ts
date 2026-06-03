import { apiClient } from "@/shared/api";

export interface InitRawFileUploadRequest {
  readonly datasetKey: string;
  readonly name: string;
  readonly sourceType: string;
  readonly filename: string;
  readonly contentType: string;
  readonly sizeBytes: number;
}

export interface InitRawFileUploadResponse {
  readonly datasetId: number;
  readonly datasetKey: string;
  readonly workspaceId: number;
  readonly uploadUrl: string;
  readonly objectKey: string;
  readonly contentType: string;
  readonly expiresInSeconds: number;
  readonly serverSideEncryptionRequired: boolean;
}

export interface CompleteRawFileUploadResponse {
  readonly datasetId: number;
  readonly datasetKey: string;
  readonly workspaceId: number;
  readonly objectKey: string;
  readonly sizeBytes: number;
  readonly status: string;
}

export function initRawFileUpload(
  workspaceId: number,
  request: InitRawFileUploadRequest,
): Promise<InitRawFileUploadResponse> {
  // OpenAPI-ungenerated: presigned upload init endpoint is not in generated client yet.
  return apiClient.post<InitRawFileUploadResponse>(
    `/workspaces/${workspaceId}/datasets/uploads:init`,
    request,
  );
}

export function completeRawFileUpload(
  workspaceId: number,
  datasetId: number,
): Promise<CompleteRawFileUploadResponse> {
  // OpenAPI-ungenerated: presigned upload complete endpoint is not in generated client yet.
  return apiClient.post<CompleteRawFileUploadResponse>(
    `/workspaces/${workspaceId}/datasets/uploads/${datasetId}:complete`,
    undefined,
  );
}
