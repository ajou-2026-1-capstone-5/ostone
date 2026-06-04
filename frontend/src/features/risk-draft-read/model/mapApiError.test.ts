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

  it("서버 오류는 추적 가능한 서버 메시지로 매핑한다", () => {
    expect(mapApiError(new ApiRequestError(500, "SERVER_ERROR", "서버 오류"))).toEqual({
      status: "error",
      code: "SERVER_ERROR",
      message: RISK_READ_ERROR_MESSAGES.SERVER_ERROR,
      httpStatus: 500,
    });
  });

  it("권한 오류는 권한 안내 메시지로 매핑한다", () => {
    expect(mapApiError(new ApiRequestError(403, "FORBIDDEN", "권한 없음"))).toEqual({
      status: "error",
      code: "FORBIDDEN",
      message: RISK_READ_ERROR_MESSAGES.FORBIDDEN,
      httpStatus: 403,
    });
  });

  it("응답 계약 오류는 상세 응답 형식 오류로 변환한다", () => {
    expect(mapApiError(new Error("Risk 상세 응답을 확인할 수 없습니다."))).toEqual({
      status: "error",
      code: "RISK_DETAIL_RESPONSE_INVALID",
      message: RISK_READ_ERROR_MESSAGES.RESPONSE_CONTRACT_ERROR,
    });
  });

  it("네트워크 오류는 재시도 가능한 연결 안내로 변환한다", () => {
    expect(mapApiError(new Error("network"))).toEqual({
      status: "error",
      code: "NETWORK_ERROR",
      message: RISK_READ_ERROR_MESSAGES.NETWORK_ERROR,
    });
  });

  it("분류할 수 없는 오류는 UNKNOWN_ERROR로 변환한다", () => {
    expect(mapApiError(new Error("unexpected"))).toEqual({
      status: "error",
      code: "UNKNOWN_ERROR",
      message: RISK_READ_ERROR_MESSAGES.UNKNOWN,
    });
  });
});
