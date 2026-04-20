import { describe, expect, it } from "vite-plus/test";
import { resolveApiBase } from "./index";

describe("resolveApiBase", () => {
  it("VITE_API_BASE_URL 절대 URL override를 그대로 사용한다", () => {
    expect(resolveApiBase("https://ostone-backend.onrender.com/api/v1")).toBe(
      "https://ostone-backend.onrender.com/api/v1",
    );
  });

  it("VITE_API_BASE_URL이 없으면 기본 상대 경로를 사용한다", () => {
    expect(resolveApiBase(undefined)).toBe("/api/v1");
  });
});
