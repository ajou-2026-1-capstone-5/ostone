import { describe, expect, it } from "vitest";
import { policyEditSchema } from "./schema";

const validPolicyValues = {
  name: "환불 정책",
  description: null,
  severity: "HIGH",
  conditionJson: "{}",
  actionJson: "{}",
  evidenceJson: "[]",
  metaJson: "{}",
};

describe("policyEditSchema", () => {
  it("유효한 policy 수정 값을 통과시킨다", () => {
    const result = policyEditSchema.safeParse(validPolicyValues);
    expect(result.success).toBe(true);
  });

  it("name이 공백이면 실패한다", () => {
    const result = policyEditSchema.safeParse({ ...validPolicyValues, name: "   " });
    expect(result.success).toBe(false);
  });

  it("conditionJson은 JSON object 문자열이어야 한다", () => {
    const result = policyEditSchema.safeParse({
      ...validPolicyValues,
      conditionJson: "[]",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("조건 JSON은 객체여야 합니다.");
    }
  });

  it("evidenceJson은 JSON array 문자열이어야 한다", () => {
    const result = policyEditSchema.safeParse({
      ...validPolicyValues,
      evidenceJson: "{}",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("근거 JSON은 배열이어야 합니다.");
    }
  });

  it("actionJson은 JSON object 문자열이어야 한다", () => {
    const result = policyEditSchema.safeParse({
      ...validPolicyValues,
      actionJson: "[]",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("액션 JSON은 객체여야 합니다.");
    }
  });

  it("metaJson은 JSON object 문자열이어야 한다", () => {
    const result = policyEditSchema.safeParse({
      ...validPolicyValues,
      metaJson: "[]",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("메타 JSON은 객체여야 합니다.");
    }
  });

  it("잘못된 JSON 문자열이면 실패한다", () => {
    const result = policyEditSchema.safeParse({
      ...validPolicyValues,
      conditionJson: "{",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("조건 JSON은 객체여야 합니다.");
    }
  });
});
