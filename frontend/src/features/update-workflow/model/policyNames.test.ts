import { describe, expect, it } from "vitest";
import { buildPolicyNameMap, resolvePolicyName } from "./policyNames";

describe("buildPolicyNameMap", () => {
  it("policyCode → name 맵을 만든다", () => {
    const map = buildPolicyNameMap([
      { policyCode: "PR-001", name: "환불 승인 기준" },
      { policyCode: "PR-002", name: "교환 기준" },
    ]);

    expect(map.get("PR-001")).toBe("환불 승인 기준");
    expect(map.get("PR-002")).toBe("교환 기준");
    expect(map.size).toBe(2);
  });

  it("코드나 이름이 비면 제외하고 공백은 trim한다", () => {
    const map = buildPolicyNameMap([
      { policyCode: "  PR-003  ", name: "  본인 확인  " },
      { policyCode: "", name: "이름만" },
      { policyCode: "PR-004", name: "" },
      { name: "코드 없음" },
    ]);

    expect(map.get("PR-003")).toBe("본인 확인");
    expect(map.has("PR-004")).toBe(false);
    expect(map.size).toBe(1);
  });
});

describe("resolvePolicyName", () => {
  const map = new Map([["PR-001", "환불 승인 기준"]]);

  it("빈 코드는 unset 상태다", () => {
    expect(resolvePolicyName(map, "")).toEqual({ status: "unset" });
    expect(resolvePolicyName(map, "   ")).toEqual({ status: "unset" });
  });

  it("등록된 코드는 resolved와 이름을 반환한다", () => {
    expect(resolvePolicyName(map, "PR-001")).toEqual({ status: "resolved", name: "환불 승인 기준" });
    expect(resolvePolicyName(map, "  PR-001 ")).toEqual({
      status: "resolved",
      name: "환불 승인 기준",
    });
  });

  it("미등록 코드는 unknown 상태다", () => {
    expect(resolvePolicyName(map, "PR-999")).toEqual({ status: "unknown" });
  });
});
