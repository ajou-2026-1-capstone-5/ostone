import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PresignedUploadAbortError,
  PresignedUploadError,
  putPresignedFile,
} from "./presignedUpload";

// XHR upload 이벤트를 흉내내는 최소 이벤트 타겟
class MockXhrUpload extends EventTarget {}

class MockXHR extends EventTarget {
  readonly upload = new MockXhrUpload();
  status = 200;
  readonly openArgs: unknown[] = [];
  readonly headers: Record<string, string> = {};
  sentBody: unknown = undefined;
  aborted = false;

  open(...args: unknown[]) {
    this.openArgs.push(...args);
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  abort() {
    this.aborted = true;
    this.dispatchEvent(new Event("abort"));
  }

  send(body: unknown) {
    this.sentBody = body;
  }

  // 헬퍼: 진행률 이벤트 발사
  triggerProgress(loaded: number, total: number) {
    const event = Object.assign(new Event("progress"), {
      lengthComputable: true,
      loaded,
      total,
    });
    this.upload.dispatchEvent(event);
  }

  // 헬퍼: load 이벤트 발사 (status 세팅 후 호출)
  triggerLoad() {
    this.dispatchEvent(new Event("load"));
  }

  // 헬퍼: network error 이벤트 발사
  triggerError() {
    this.dispatchEvent(new Event("error"));
  }
}

let mockXhr: MockXHR;

beforeEach(() => {
  mockXhr = new MockXHR();
  // new XMLHttpRequest() 호출 시 mockXhr 인스턴스를 반환하기 위해 class 문법 사용
  const XhrCtor = class {
    constructor() {
      return mockXhr;
    }
  };
  vi.stubGlobal("XMLHttpRequest", XhrCtor);
});

const makeFile = (name = "test.zip") => new File(["PK"], name, { type: "application/zip" });

describe("putPresignedFile", () => {
  it("presigned PUT 성공 시 resolve된다", async () => {
    mockXhr.status = 200;
    const promise = putPresignedFile({
      uploadUrl: "https://s3.example.com/key",
      file: makeFile(),
      contentType: "application/zip",
      serverSideEncryptionRequired: false,
    });

    mockXhr.triggerLoad();
    await expect(promise).resolves.toBeUndefined();
  });

  it("200-299 범위의 모든 2xx 상태를 성공으로 처리한다", async () => {
    mockXhr.status = 204;
    const promise = putPresignedFile({
      uploadUrl: "https://s3.example.com/key",
      file: makeFile(),
      contentType: "application/zip",
      serverSideEncryptionRequired: false,
    });

    mockXhr.triggerLoad();
    await expect(promise).resolves.toBeUndefined();
  });

  it("비-2xx 상태코드 응답 시 PresignedUploadError를 reject한다", async () => {
    mockXhr.status = 403;
    const promise = putPresignedFile({
      uploadUrl: "https://s3.example.com/key",
      file: makeFile(),
      contentType: "application/zip",
      serverSideEncryptionRequired: false,
    });

    mockXhr.triggerLoad();
    const error = await promise.catch((e) => e);
    expect(error).toBeInstanceOf(PresignedUploadError);
    expect((error as PresignedUploadError).status).toBe(403);
  });

  it("500 서버 오류 시 PresignedUploadError를 reject한다", async () => {
    mockXhr.status = 500;
    const promise = putPresignedFile({
      uploadUrl: "https://s3.example.com/key",
      file: makeFile(),
      contentType: "application/zip",
      serverSideEncryptionRequired: false,
    });

    mockXhr.triggerLoad();
    const error = await promise.catch((e) => e);
    expect(error).toBeInstanceOf(PresignedUploadError);
    expect((error as PresignedUploadError).status).toBe(500);
  });

  it("네트워크 오류 시 PresignedUploadError(status=null)를 reject한다", async () => {
    const promise = putPresignedFile({
      uploadUrl: "https://s3.example.com/key",
      file: makeFile(),
      contentType: "application/zip",
      serverSideEncryptionRequired: false,
    });

    mockXhr.triggerError();
    const error = await promise.catch((e) => e);
    expect(error).toBeInstanceOf(PresignedUploadError);
    expect((error as PresignedUploadError).status).toBeNull();
  });

  it("onProgress 콜백이 진행률을 퍼센트로 전달받는다", async () => {
    const onProgress = vi.fn();
    const promise = putPresignedFile({
      uploadUrl: "https://s3.example.com/key",
      file: makeFile(),
      contentType: "application/zip",
      serverSideEncryptionRequired: false,
      onProgress,
    });

    mockXhr.triggerProgress(50, 100);
    mockXhr.triggerProgress(100, 100);
    mockXhr.status = 200;
    mockXhr.triggerLoad();
    await promise;

    expect(onProgress).toHaveBeenCalledWith(50);
    expect(onProgress).toHaveBeenCalledWith(100);
  });

  it("lengthComputable이 false이면 onProgress를 호출하지 않는다", async () => {
    const onProgress = vi.fn();
    const promise = putPresignedFile({
      uploadUrl: "https://s3.example.com/key",
      file: makeFile(),
      contentType: "application/zip",
      serverSideEncryptionRequired: false,
      onProgress,
    });

    const event = Object.assign(new Event("progress"), {
      lengthComputable: false,
      loaded: 50,
      total: 0,
    });
    mockXhr.upload.dispatchEvent(event);
    mockXhr.status = 200;
    mockXhr.triggerLoad();
    await promise;

    expect(onProgress).not.toHaveBeenCalled();
  });

  it("signal.abort() 호출 시 PresignedUploadAbortError를 reject한다", async () => {
    const controller = new AbortController();
    const promise = putPresignedFile({
      uploadUrl: "https://s3.example.com/key",
      file: makeFile(),
      contentType: "application/zip",
      serverSideEncryptionRequired: false,
      signal: controller.signal,
    });

    controller.abort();
    const error = await promise.catch((e) => e);
    expect(error).toBeInstanceOf(PresignedUploadAbortError);
  });

  it("이미 abort된 signal을 전달하면 즉시 PresignedUploadAbortError를 reject한다", async () => {
    const controller = new AbortController();
    controller.abort();

    const error = await putPresignedFile({
      uploadUrl: "https://s3.example.com/key",
      file: makeFile(),
      contentType: "application/zip",
      serverSideEncryptionRequired: false,
      signal: controller.signal,
    }).catch((e) => e);

    expect(error).toBeInstanceOf(PresignedUploadAbortError);
  });

  it("serverSideEncryptionRequired=true 이면 x-amz-server-side-encryption 헤더를 설정한다", async () => {
    const promise = putPresignedFile({
      uploadUrl: "https://s3.example.com/key",
      file: makeFile(),
      contentType: "application/zip",
      serverSideEncryptionRequired: true,
    });

    mockXhr.status = 200;
    mockXhr.triggerLoad();
    await promise;

    expect(mockXhr.headers["x-amz-server-side-encryption"]).toBe("AES256");
  });

  it("serverSideEncryptionRequired=false 이면 x-amz-server-side-encryption 헤더를 설정하지 않는다", async () => {
    const promise = putPresignedFile({
      uploadUrl: "https://s3.example.com/key",
      file: makeFile(),
      contentType: "application/zip",
      serverSideEncryptionRequired: false,
    });

    mockXhr.status = 200;
    mockXhr.triggerLoad();
    await promise;

    expect(mockXhr.headers["x-amz-server-side-encryption"]).toBeUndefined();
  });

  it("Content-Type 헤더가 지정된 값으로 설정된다", async () => {
    const promise = putPresignedFile({
      uploadUrl: "https://s3.example.com/key",
      file: makeFile(),
      contentType: "application/x-zip-compressed",
      serverSideEncryptionRequired: false,
    });

    mockXhr.status = 200;
    mockXhr.triggerLoad();
    await promise;

    expect(mockXhr.headers["Content-Type"]).toBe("application/x-zip-compressed");
  });

  it("파일 본문이 xhr.send로 전달된다", async () => {
    const file = makeFile();
    const promise = putPresignedFile({
      uploadUrl: "https://s3.example.com/key",
      file,
      contentType: "application/zip",
      serverSideEncryptionRequired: false,
    });

    mockXhr.status = 200;
    mockXhr.triggerLoad();
    await promise;

    expect(mockXhr.sentBody).toBe(file);
  });
});
