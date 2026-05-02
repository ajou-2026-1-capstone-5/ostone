import { describe, expect, it, vi, afterEach } from "vite-plus/test";
import { apiClient } from "./index";
import { customFetch } from "./mutator";

vi.mock("./index", () => ({
  apiClient: {
    request: vi.fn(() => Promise.resolve({})),
  },
}));

describe("customFetch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("apiClient.request에 URL과 options를 전달한다", async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ data: "hello" });

    const result = await customFetch<{ data: string }>("/test", {
      method: "GET",
    });

    expect(apiClient.request).toHaveBeenCalledWith(
      "/test",
      { method: "GET" },
    );
    expect(result).toEqual({ data: "hello" });
  });

  it("POST 요청을 apiClient.request에 전달한다", async () => {
    const bodyData = { name: "test" };
    vi.mocked(apiClient.request).mockResolvedValueOnce({ id: 1 });

    await customFetch("/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyData),
    });

    expect(apiClient.request).toHaveBeenCalledWith("/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyData),
    });
  });

  it("PATCH 요청을 apiClient.request에 전달한다", async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({});

    await customFetch("/items/1", {
      method: "PATCH",
      body: JSON.stringify({ field: "updated" }),
    });

    expect(apiClient.request).toHaveBeenCalledWith("/items/1", {
      method: "PATCH",
      body: JSON.stringify({ field: "updated" }),
    });
  });

  it("DELETE 요청을 apiClient.request에 전달한다", async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce(undefined);

    await customFetch("/test", { method: "DELETE" });

    expect(apiClient.request).toHaveBeenCalledWith("/test", {
      method: "DELETE",
    });
  });

  it("URL에 / 접두사가 없으면 자동으로 추가한다", async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({});

    await customFetch("items", { method: "GET" });

    expect(apiClient.request).toHaveBeenCalledWith("/items", {
      method: "GET",
    });
  });

  it("apiClient.request의 rejection을 전파한다", async () => {
    const apiError = new Error("Network error");
    vi.mocked(apiClient.request).mockRejectedValueOnce(apiError);

    await expect(
      customFetch("/test", { method: "GET" }),
    ).rejects.toThrow("Network error");
  });

  it("URL에 /api/v1 prefix가 있으면 제거하여 apiClient.request에 전달한다", async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({});

    await customFetch("/api/v1/test", { method: "GET" });

    expect(apiClient.request).toHaveBeenCalledWith("/test", {
      method: "GET",
    });
  });

  it("URL에 /api/v1 prefix가 없으면 그대로 전달한다", async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({});

    await customFetch("/test", { method: "GET" });

    expect(apiClient.request).toHaveBeenCalledWith("/test", {
      method: "GET",
    });
  });

  it("URL이 정확히 /api/v1이면 '/'로 정규화한다", async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({});

    await customFetch("/api/v1", { method: "GET" });

    expect(apiClient.request).toHaveBeenCalledWith("/", {
      method: "GET",
    });
  });

  it("URL에 /api/v1 prefix가 있고 남은 경로에 /가 없으면 추가한다", async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({});

    await customFetch("/api/v1items", { method: "GET" });

    expect(apiClient.request).toHaveBeenCalledWith("/items", {
      method: "GET",
    });
  });
});
