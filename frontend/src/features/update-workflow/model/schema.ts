import { z } from "zod";

export const workflowEditSchema = z.object({
  name: z.string().trim().min(1, "워크플로우 이름은 필수입니다."),
  description: z.string().nullable().optional(),
});

export type WorkflowEditFormValues = z.infer<typeof workflowEditSchema>;
