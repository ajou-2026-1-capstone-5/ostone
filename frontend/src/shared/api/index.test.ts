import { describe, expect, it, vi, beforeEach, afterEach, afterAll } from "vite-plus/test";
import { resolveApiBase, ApiRequestError, apiClient, accessDeniedMessage } from "./index";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers,
  });
}

function emptyResponse(init: ResponseInit = {}): Response {
  return new Response(null, {
    status: 200,
    ...init,
  });
}

function textResponse(body: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "text/plain");

  return new Response(body, {
    status: 200,
    ...init,
    headers,
  });
}

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("accessDeniedMessage", () => {
  it("403 ApiRequestError면 백엔드 메시지를 반환한다", () => {
    expect(
      accessDeniedMessage(new ApiRequestError(403, "WORKSPACE_ACCESS_DENIED", "권한이 없습니다.")),
    ).toBe("권한이 없습니다.");
  });

  it("403이지만 메시지가 비어 있으면 기본 안내 문구를 반환한다", () => {
    expect(accessDeniedMessage(new ApiRequestError(403, "WORKSPACE_ACCESS_DENIED", "   "))).toBe(
      "이 작업을 수행할 권한이 없습니다.",
    );
  });

  it("403이 아닌 ApiRequestError면 null을 반환한다", () => {
    expect(accessDeniedMessage(new ApiRequestError(500, "INTERNAL_ERROR", "서버 오류"))).toBeNull();
  });

  it("ApiRequestError가 아니면 null을 반환한다", () => {
    expect(accessDeniedMessage(new Error("network"))).toBeNull();
    expect(accessDeniedMessage(null)).toBeNull();
  });
});

describe("resolveApiBase", () => {
  it("VITE_API_BASE_URL 절대 URL override를 그대로 사용한다", () => {
    expect(resolveApiBase("https://api.ostone.example/api/v1")).toBe(
      "https://api.ostone.example/api/v1",
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
  const getStoredItem = (key: string) => originalGetItem.call(localStorage, key);

  beforeEach(() => {
    mockFetch.mockClear();
    originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = vi.fn(() => "mock-token");
  });

  afterEach(() => {
    localStorage.clear();
    Storage.prototype.getItem = originalGetItem;
  });

  describe("post", () => {
    it("POST 메서드로 fetch를 호출하고 body를 JSON.stringify한다", async () => {
      const mockResponse = { id: 1, name: "test" };
      mockFetch.mockResolvedValueOnce(jsonResponse(mockResponse));

      const result = await apiClient.post<{ id: number; name: string }>("/test", { name: "test" });

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
      mockFetch.mockResolvedValueOnce(jsonResponse(mockResponse));

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
      mockFetch.mockResolvedValueOnce(jsonResponse(mockResponse));

      const result = await apiClient.patch<{ id: number; name: string }>("/test/1", {
        name: "updated",
      });

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
      mockFetch.mockResolvedValueOnce(emptyResponse({ status: 204 }));

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
      mockFetch.mockResolvedValueOnce(jsonResponse(mockResponse));

      const result = await apiClient.request<{ success: boolean }>("/test", {
        method: "PUT",
        headers: { "X-Custom-Header": "value" },
      });

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

    it("auth endpoint 요청에는 저장된 access token을 Authorization header로 붙이지 않는다", async () => {
      const mockResponse = { success: true };
      mockFetch.mockResolvedValueOnce(jsonResponse(mockResponse));

      await apiClient.request<{ success: boolean }>("/auth/login", {
        method: "POST",
        body: { email: "admin@ostone.com", password: "wrong-password" } as unknown as BodyInit,
      });

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers as Headers;
      expect(headers.get("Authorization")).toBeNull();
    });

    it("demo endpoint 요청에는 저장된 access token을 Authorization header로 붙이지 않는다", async () => {
      const mockResponse = { id: 1 };
      mockFetch.mockResolvedValueOnce(jsonResponse(mockResponse));

      await apiClient.request<{ id: number }>("/workspaces/2/demo/chat-sessions", {
        method: "POST",
        body: { customerName: "박하나" } as unknown as BodyInit,
      });

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers as Headers;
      expect(headers.get("Authorization")).toBeNull();
    });

    it("body가 object인 경우 JSON.stringify한다", async () => {
      const mockResponse = { id: 1 };
      mockFetch.mockResolvedValueOnce(jsonResponse(mockResponse));

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
      mockFetch.mockResolvedValueOnce(jsonResponse(mockResponse));

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
      mockFetch.mockResolvedValueOnce(jsonResponse(mockResponse));

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
      mockFetch.mockResolvedValueOnce(emptyResponse({ status: 204 }));

      const result = await apiClient.get<void>("/test");

      expect(result).toBeUndefined();
    });

    it("200 빈 본문 성공 응답 시 undefined를 반환한다", async () => {
      mockFetch.mockResolvedValueOnce(
        emptyResponse({
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await apiClient.get<void>("/test");

      expect(result).toBeUndefined();
    });

    it("JSON 성공 응답은 body를 파싱해 반환한다", async () => {
      const mockResponse = { id: 1, name: "test" };
      mockFetch.mockResolvedValueOnce(jsonResponse(mockResponse));

      const result = await apiClient.get<{ id: number; name: string }>("/test");

      expect(result).toEqual(mockResponse);
    });

    it("JSON이 아닌 성공 응답은 파싱하지 않고 undefined를 반환한다", async () => {
      mockFetch.mockResolvedValueOnce(textResponse("ok"));

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

      await expect(apiClient.get<{ id: number }>("/test")).rejects.toThrow("잘못된 요청입니다.");
      await expect(apiClient.get<{ id: number }>("/test")).rejects.toThrow(ApiRequestError);
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

    it("401 응답 시 auth session을 정리한다", async () => {
      localStorage.setItem("accessToken", "mock-token");
      localStorage.setItem("refreshToken", "mock-refresh-token");
      localStorage.setItem("user", JSON.stringify({ id: 1 }));
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          code: "UNAUTHORIZED",
          message: "인증이 필요합니다.",
        }),
      });

      await expect(apiClient.get<{ id: number }>("/test")).rejects.toMatchObject({
        status: 401,
        code: "UNAUTHORIZED",
      });

      expect(getStoredItem("accessToken")).toBeNull();
      expect(getStoredItem("refreshToken")).toBeNull();
      expect(getStoredItem("user")).toBeNull();
    });

    it("인증된 요청 401 후 refresh 성공 시 새 access token으로 원 요청을 한 번 재시도한다", async () => {
      Storage.prototype.getItem = vi.fn((key: string) => originalGetItem.call(localStorage, key));
      localStorage.setItem("accessToken", "expired-access-token");
      localStorage.setItem("refreshToken", "legacy-refresh-token");
      localStorage.setItem("user", JSON.stringify({ id: 1 }));
      mockFetch
        .mockResolvedValueOnce(
          jsonResponse(
            {
              code: "UNAUTHORIZED",
              message: "인증이 필요합니다.",
            },
            { status: 401 },
          ),
        )
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            accessToken: "new-access-token",
            tokenType: "Bearer",
            expiresIn: 3600,
          }),
        })
        .mockResolvedValueOnce(jsonResponse({ id: 1 }));

      const result = await apiClient.get<{ id: number }>("/test");

      expect(result).toEqual({ id: 1 });
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        "/api/v1/auth/refresh",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        }),
      );
      expect(mockFetch.mock.calls[1][1]).not.toHaveProperty("body");

      const retryHeaders = mockFetch.mock.calls[2][1].headers as Headers;
      expect(retryHeaders.get("Authorization")).toBe("Bearer new-access-token");
      expect(getStoredItem("accessToken")).toBe("new-access-token");
      expect(getStoredItem("refreshToken")).toBeNull();
      expect(getStoredItem("user")).toBe(JSON.stringify({ id: 1 }));
    });

    it("인증된 요청 401 후 refresh 실패 시 auth session을 정리하고 원 응답 에러를 반환한다", async () => {
      Storage.prototype.getItem = vi.fn((key: string) => originalGetItem.call(localStorage, key));
      localStorage.setItem("accessToken", "expired-access-token");
      localStorage.setItem("refreshToken", "legacy-expired-refresh-token");
      localStorage.setItem("user", JSON.stringify({ id: 1 }));
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({
            code: "UNAUTHORIZED",
            message: "인증이 필요합니다.",
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({
            code: "INVALID_TOKEN",
            message: "만료되거나 폐기된 리프레시 토큰입니다.",
          }),
        });

      await expect(apiClient.get<{ id: number }>("/test")).rejects.toMatchObject({
        status: 401,
        code: "UNAUTHORIZED",
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        "/api/v1/auth/refresh",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        }),
      );
      expect(getStoredItem("accessToken")).toBeNull();
      expect(getStoredItem("refreshToken")).toBeNull();
      expect(getStoredItem("user")).toBeNull();
    });

    it("auth endpoint의 401 응답 시 기존 auth session을 유지한다", async () => {
      localStorage.setItem("accessToken", "mock-token");
      localStorage.setItem("refreshToken", "mock-refresh-token");
      localStorage.setItem("user", JSON.stringify({ id: 1 }));
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          code: "UNAUTHORIZED",
          message: "이메일 또는 비밀번호가 올바르지 않습니다.",
        }),
      });

      await expect(
        apiClient.request<{ id: number }>("/auth/login", {
          method: "POST",
          body: { email: "admin@ostone.com", password: "wrong-password" } as unknown as BodyInit,
        }),
      ).rejects.toMatchObject({
        status: 401,
        code: "UNAUTHORIZED",
      });

      expect(getStoredItem("accessToken")).toBe("mock-token");
      expect(getStoredItem("refreshToken")).toBe("mock-refresh-token");
      expect(getStoredItem("user")).toBe(JSON.stringify({ id: 1 }));
    });

    it("401 외 non-ok 응답 시 auth session을 유지한다", async () => {
      localStorage.setItem("accessToken", "mock-token");
      localStorage.setItem("refreshToken", "mock-refresh-token");
      localStorage.setItem("user", JSON.stringify({ id: 1 }));
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          code: "FORBIDDEN",
          message: "권한이 없습니다.",
        }),
      });

      await expect(apiClient.get<{ id: number }>("/test")).rejects.toMatchObject({
        status: 403,
        code: "FORBIDDEN",
      });

      expect(getStoredItem("accessToken")).toBe("mock-token");
      expect(getStoredItem("refreshToken")).toBe("mock-refresh-token");
      expect(getStoredItem("user")).toBe(JSON.stringify({ id: 1 }));
    });
  });
});
