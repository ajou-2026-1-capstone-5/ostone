import { describe, expect, it } from "vitest";
import { riskEditSchema } from "./schema";

const validRiskValues = {
  name: "사기 위험",
  description: null,
  riskLevel: "HIGH",
  triggerConditionJson: "{}",
  handlingActionJson: "{}",
  evidenceJson: "[]",
  metaJson: "{}",
};

describe("riskEditSchema", () => {
  it("유효한 risk 수정 값을 통과시킨다", () => {
    const result = riskEditSchema.safeParse(validRiskValues);
    expect(result.success).toBe(true);
  });

  it("name이 공백이면 실패한다", () => {
    const result = riskEditSchema.safeParse({ ...validRiskValues, name: "   " });
    expect(result.success).toBe(false);
  });

  it("riskLevel은 허용된 값이어야 한다", () => {
    const result = riskEditSchema.safeParse({ ...validRiskValues, riskLevel: "BLOCKER" });
    expect(result.success).toBe(false);
  });

  it("triggerConditionJson은 JSON object 문자열이어야 한다", () => {
    const result = riskEditSchema.safeParse({
      ...validRiskValues,
      triggerConditionJson: "[]",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("트리거 조건 JSON은 객체여야 합니다.");
    }
  });

  it("handlingActionJson은 JSON object 문자열이어야 한다", () => {
    const result = riskEditSchema.safeParse({
      ...validRiskValues,
      handlingActionJson: "[]",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("처리 액션 JSON은 객체여야 합니다.");
    }
  });

  it("evidenceJson은 JSON array 문자열이어야 한다", () => {
    const result = riskEditSchema.safeParse({
      ...validRiskValues,
      evidenceJson: "{}",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("근거 JSON은 배열이어야 합니다.");
    }
  });

  it("잘못된 JSON 문자열이면 실패한다", () => {
    const result = riskEditSchema.safeParse({
      ...validRiskValues,
      metaJson: "{",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("메타 JSON은 객체여야 합니다.");
    }
  });
});
