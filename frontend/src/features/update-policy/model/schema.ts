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

export const policyEditSchema = z.object({
  name: z.string().trim().min(1, "정책 이름은 필수입니다."),
  description: z.string().nullable().optional(),
  severity: z.string().nullable().optional(),
  conditionJson: jsonObjectString("조건 JSON은 객체여야 합니다."),
  actionJson: jsonObjectString("액션 JSON은 객체여야 합니다."),
  evidenceJson: jsonArrayString("근거 JSON은 배열이어야 합니다."),
  metaJson: jsonObjectString("메타 JSON은 객체여야 합니다."),
});

export type PolicyEditFormValues = z.infer<typeof policyEditSchema>;
