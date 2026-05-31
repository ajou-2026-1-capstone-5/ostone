import { z } from "zod";

import { jsonArrayString, jsonObjectString } from "@/shared/lib/jsonSchema";

export const riskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const riskEditSchema = z.object({
  name: z.string().trim().min(1, "주의 사항 이름은 필수입니다."),
  description: z.string().nullable().optional(),
  riskLevel: riskLevelSchema,
  triggerConditionJson: jsonObjectString("감지 조건 JSON은 객체여야 합니다."),
  handlingActionJson: jsonObjectString("응대 방법 JSON은 객체여야 합니다."),
  evidenceJson: jsonArrayString("근거 JSON은 배열이어야 합니다."),
  metaJson: jsonObjectString("추가 정보 JSON은 객체여야 합니다."),
});

export type RiskEditFormValues = z.infer<typeof riskEditSchema>;
