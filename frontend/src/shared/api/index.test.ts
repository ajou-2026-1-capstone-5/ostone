import { describe, expect, it, vi, beforeEach, afterEach, afterAll } from "vite-plus/test";
import { resolveApiBase, ApiRequestError, apiClient } from "./index";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("resolveApiBase", () => {
  it("VITE_API_BASE_URL 절대 URL override를 그대로 사용한다", () => {
    expect(resolveApiBase("https://ostone-backend.onrender.com/api/v1")).toBe(
      "https://ostone-backend.onrender.com/api/v1",
    );
  });

  it("VITE_API_BASE_URL이 없으면 기본 상대 경로를 사용한다", () => {
    expect(resolveApiBase(undefined)).toBe("/api/v1");
  });

  it("정의된 상대 경로를 그대로 반환한다", () => {
    expect(resolveApiBase("/custom/api")).toBe("/custom/api");
  });

  it("빈 문자열 입력 시 기본값을 반환한다 (falsy 값)", () => {
    expect(resolveApiBase("")).toBe("/api/v1");
  });
});

describe("apiClient", () => {
  let originalGetItem: typeof Storage.prototype.getItem;

  beforeEach(() => {
    mockFetch.mockClear();
    originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = vi.fn(() => "mock-token");
  });

  afterEach(() => {
    Storage.prototype.getItem = originalGetItem;
  });

  describe("post", () => {
    it("POST 메서드로 fetch를 호출하고 body를 JSON.stringify한다", async () => {
      const mockResponse = { id: 1, name: "test" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await apiClient.post<{ id: number; name: string }>(
        "/test",
        { name: "test" },
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/test",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ name: "test" }),
        }),
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe("get", () => {
    it("GET 메서드로 fetch를 호출하고 signal을 전달한다", async () => {
      const mockResponse = { data: "test" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const abortController = new AbortController();
      const result = await apiClient.get<{ data: string }>("/test", {
        signal: abortController.signal,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/test",
        expect.objectContaining({
          method: "GET",
          signal: abortController.signal,
        }),
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe("patch", () => {
    it("PATCH 메서드로 fetch를 호출하고 body를 JSON.stringify한다", async () => {
      const mockResponse = { id: 1, name: "updated" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await apiClient.patch<{ id: number; name: string }>(
        "/test/1",
        { name: "updated" },
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/test/1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ name: "updated" }),
        }),
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe("delete", () => {
    it("DELETE 메서드로 fetch를 호출한다", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await apiClient.delete<void>("/test/1");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/test/1",
        expect.objectContaining({
          method: "DELETE",
        }),
      );
    });
  });

  describe("request", () => {
    it("임의 메서드로 fetch를 호출하고 headers를 병합한다", async () => {
      const mockResponse = { success: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await apiClient.request<{ success: boolean }>(
        "/test",
        {
          method: "PUT",
          headers: { "X-Custom-Header": "value" },
        },
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/test",
        expect.objectContaining({
          method: "PUT",
          headers: expect.any(Headers),
        }),
      );

      // Headers 인스턴스 내용 검증
      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers as Headers;
      expect(headers.get("Content-Type")).toBe("application/json");
      expect(headers.get("X-Custom-Header")).toBe("value");

      expect(result).toEqual(mockResponse);
    });

    it("body가 object인 경우 JSON.stringify한다", async () => {
      const mockResponse = { id: 1 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const testData = { name: "test" };
      await apiClient.request<{ id: number }>("/test", {
        method: "POST",
        body: testData as unknown as BodyInit,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/test",
        expect.objectContaining({
          body: JSON.stringify({ name: "test" }),
        }),
      );
    });

    it("body가 Blob인 경우 그대로 전달한다", async () => {
      const mockResponse = { id: 1 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const blob = new Blob(["test"], { type: "image/png" });
      await apiClient.request<{ id: number }>("/test", {
        method: "POST",
        body: blob,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/test",
        expect.objectContaining({
          body: blob,
        }),
      );
    });

    it("body가 FormData인 경우 그대로 전달한다", async () => {
      const mockResponse = { id: 1 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const formData = new FormData();
      formData.append("file", new Blob(["test"]));
      await apiClient.request<{ id: number }>("/test", {
        method: "POST",
        body: formData,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/test",
        expect.objectContaining({
          body: formData,
        }),
      );
    });
  });

  describe("handleResponse", () => {
    it("204 응답 시 undefined를 반환한다", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const result = await apiClient.get<void>("/test");

      expect(result).toBeUndefined();
    });

    it("non-ok 응답 시 ApiRequestError를 던진다", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          code: "BAD_REQUEST",
          message: "잘못된 요청입니다.",
        }),
      });

      await expect(apiClient.get<{ id: number }>("/test")).rejects.toThrow(
        "잘못된 요청입니다.",
      );
      await expect(apiClient.get<{ id: number }>("/test")).rejects.toThrow(
        ApiRequestError,
      );
    });

    it("non-ok 응답 且 JSON 파싱 실패 시 기본 에러 메시지를 사용한다", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("parse error");
        },
      });

      await expect(apiClient.get<{ id: number }>("/test")).rejects.toThrow(
        "요청 처리 중 오류가 발생했습니다.",
      );
    });
  });
});
