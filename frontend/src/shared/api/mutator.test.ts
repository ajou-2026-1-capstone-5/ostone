import { describe, expect, it, vi, beforeEach, afterEach } from "vite-plus/test";
import { customFetch } from "./mutator";
import { apiClient } from "./index";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("./index", () => ({
  apiClient: {
    request: vi.fn(() => Promise.resolve({})),
  },
}));

describe("customFetch", () => {
  let originalGetItem: typeof Storage.prototype.getItem;

  beforeEach(() => {
    mockFetch.mockClear();
    originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = vi.fn(() => "mock-token");
  });

  afterEach(() => {
    Storage.prototype.getItem = originalGetItem;
    vi.restoreAllMocks();
  });

  it("GET 메서드 시 apiClient.request를 호출한다", async () => {
    const mockRequest = apiClient.request as unknown as vi.Mock;
    mockRequest.mockResolvedValueOnce({ data: "test" });

    const result = await customFetch<{ data: string }>("/test", {
      method: "GET",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      "/test",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(result).toEqual({ data: "test" });
  });

  it("POST 메서드 시 apiClient.request를 호출한다", async () => {
    const mockRequest = apiClient.request as unknown as vi.Mock;
    mockRequest.mockResolvedValueOnce({ id: 1 });

    const result = await customFetch<{ id: number }>("/test", {
      method: "POST",
      body: JSON.stringify({ name: "test" }),
    });

    expect(mockRequest).toHaveBeenCalledWith(
      "/test",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(result).toEqual({ id: 1 });
  });

  it("PATCH 메서드 시 apiClient.request를 호출한다", async () => {
    const mockRequest = apiClient.request as unknown as vi.Mock;
    mockRequest.mockResolvedValueOnce({ id: 1, name: "updated" });

    const result = await customFetch<{ id: number; name: string }>("/test/1", {
      method: "PATCH",
      body: JSON.stringify({ name: "updated" }),
    });

    expect(mockRequest).toHaveBeenCalledWith(
      "/test/1",
      expect.objectContaining({
        method: "PATCH",
      }),
    );
    expect(result).toEqual({ id: 1, name: "updated" });
  });

  it("DELETE 메서드 시 apiClient.request를 호출한다", async () => {
    const mockRequest = apiClient.request as unknown as vi.Mock;
    mockRequest.mockResolvedValueOnce(undefined);

    await customFetch<void>("/test/1", {
      method: "DELETE",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      "/test/1",
      expect.objectContaining({
        method: "DELETE",
      }),
    );
  });

  it("URL에 / prefix가 없으면 추가한다", async () => {
    const mockRequest = apiClient.request as unknown as vi.Mock;
    mockRequest.mockResolvedValueOnce({ data: "test" });

    await customFetch<{ data: string }>("test", {
      method: "GET",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      "/test",
      expect.anything(),
    );
  });

  it("URL에 / prefix가 있으면 그대로 전달한다", async () => {
    const mockRequest = apiClient.request as unknown as vi.Mock;
    mockRequest.mockResolvedValueOnce({ data: "test" });

    await customFetch<{ data: string }>("/test", {
      method: "GET",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      "/test",
      expect.anything(),
    );
  });
});