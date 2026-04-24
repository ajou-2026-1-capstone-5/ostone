import { z } from "zod";

export const slotEditSchema = z.object({
  name: z.string().trim().min(1, "슬롯 이름은 필수입니다."),
  description: z.string().nullable().optional(),
  isSensitive: z.boolean().optional(),
  validationRuleJson: z.string().nullable().optional(),
  defaultValueJson: z.string().nullable().optional(),
  metaJson: z.string().nullable().optional(),
});

export type SlotEditFormValues = z.infer<typeof slotEditSchema>;
