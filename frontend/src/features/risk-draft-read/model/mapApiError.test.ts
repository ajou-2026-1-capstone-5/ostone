import { describe, expect, it } from "vitest";
import { ApiRequestError } from "@/shared/api";
import { RISK_READ_ERROR_MESSAGES, mapApiError } from "./mapApiError";

describe("mapApiError", () => {
  it("ApiRequestError의 상태와 코드를 유지하고 알려진 메시지로 매핑한다", () => {
    expect(mapApiError(new ApiRequestError(404, "RISK_DEFINITION_NOT_FOUND", "없음"))).toEqual({
      status: "error",
      code: "RISK_DEFINITION_NOT_FOUND",
      message: RISK_READ_ERROR_MESSAGES.NOT_FOUND,
      httpStatus: 404,
    });
  });

  it("알 수 없는 ApiRequestError 코드는 기본 메시지로 매핑한다", () => {
    expect(mapApiError(new ApiRequestError(500, "SERVER_ERROR", "서버 오류"))).toEqual({
      status: "error",
      code: "SERVER_ERROR",
      message: RISK_READ_ERROR_MESSAGES.UNKNOWN,
      httpStatus: 500,
    });
  });

  it("알 수 없는 오류는 UNKNOWN_ERROR로 변환한다", () => {
    expect(mapApiError(new Error("network"))).toEqual({
      status: "error",
      code: "UNKNOWN_ERROR",
      message: RISK_READ_ERROR_MESSAGES.UNKNOWN,
    });
  });
});
