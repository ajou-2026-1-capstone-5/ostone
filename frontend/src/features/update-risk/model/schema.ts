import { z } from "zod";

function isJsonObjectString(value: string): boolean {
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

function isJsonArrayString(value: string): boolean {
  try {
    return Array.isArray(JSON.parse(value) as unknown);
  } catch {
    return false;
  }
}

export function jsonObjectString(message: string) {
  return z.string().refine(isJsonObjectString, { message });
}

export function jsonArrayString(message: string) {
  return z.string().refine(isJsonArrayString, { message });
}

export const riskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const riskEditSchema = z.object({
  name: z.string().trim().min(1, "위험요소 이름은 필수입니다."),
  description: z.string().nullable().optional(),
  riskLevel: riskLevelSchema,
  triggerConditionJson: jsonObjectString("트리거 조건 JSON은 객체여야 합니다."),
  handlingActionJson: jsonObjectString("처리 액션 JSON은 객체여야 합니다."),
  evidenceJson: jsonArrayString("근거 JSON은 배열이어야 합니다."),
  metaJson: jsonObjectString("메타 JSON은 객체여야 합니다."),
});

export type RiskEditFormValues = z.infer<typeof riskEditSchema>;
