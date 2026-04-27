import { describe, expect, it } from "vitest";
import { ApiRequestError } from "@/shared/api";
import { mapApiError } from "./mapApiError";

describe("mapApiError", () => {
  it("ApiRequestError의 상태와 코드를 유지한다", () => {
    expect(mapApiError(new ApiRequestError(404, "POLICY_NOT_FOUND", "없음"))).toEqual({
      status: "error",
      code: "POLICY_NOT_FOUND",
      message: "없음",
      httpStatus: 404,
    });
  });

  it("알 수 없는 오류는 UNKNOWN_ERROR로 변환한다", () => {
    expect(mapApiError(new Error("network"))).toEqual({
      status: "error",
      code: "UNKNOWN_ERROR",
      message: "알 수 없는 오류가 발생했습니다.",
    });
  });
});
