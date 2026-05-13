// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ApiRequestError } from "@/shared/api";
import { resolveDomainPackApprovalErrorMessage } from "./resolveDomainPackApprovalErrorMessage";

describe("resolveDomainPackApprovalErrorMessage", () => {
  it.each([
    ["DOMAIN_PACK_VERSION_NOT_LATEST", "최신 버전만 승인할 수 있습니다."],
    ["DOMAIN_PACK_INVALID_STATE", "현재 상태에서는 승인할 수 없습니다."],
    [
      "DOMAIN_PACK_CONFLICT",
      "다른 요청으로 버전 상태가 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
    ],
    ["FORBIDDEN", "Domain Pack을 승인할 권한이 없습니다."],
    ["DOMAIN_PACK_VERSION_NOT_FOUND", "Domain Pack 버전을 찾을 수 없습니다."],
    ["DOMAIN_PACK_NOT_FOUND", "Domain Pack을 찾을 수 없습니다."],
    ["WORKSPACE_NOT_FOUND", "워크스페이스를 찾을 수 없습니다."],
    ["NOT_FOUND", "Domain Pack 또는 버전을 찾을 수 없습니다."],
    ["UNAUTHORIZED", "로그인이 필요합니다."],
  ])("error code %s에 맞는 메시지를 반환한다", (code, message) => {
    expect(
      resolveDomainPackApprovalErrorMessage(new ApiRequestError(400, code, "fail")),
    ).toBe(message);
  });

  it("error code가 없어도 HTTP 404면 not found fallback을 반환한다", () => {
    expect(
      resolveDomainPackApprovalErrorMessage(
        new ApiRequestError(404, "UNKNOWN_ERROR", "fail"),
      ),
    ).toBe("Domain Pack 또는 버전을 찾을 수 없습니다.");
  });

  it("알 수 없는 에러면 기본 실패 메시지를 반환한다", () => {
    expect(resolveDomainPackApprovalErrorMessage(new Error("fail"))).toBe(
      "Domain Pack 승인에 실패했습니다.",
    );
  });
});
