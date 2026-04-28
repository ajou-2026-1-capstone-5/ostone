import type { FieldPath } from "react-hook-form";
import { useFormContext } from "react-hook-form";
import { JsonFormField } from "@/shared/ui/json-form-field";
import type { RiskEditFormValues } from "../model/schema";

const JSON_FIELDS = [
  { name: "triggerConditionJson", label: "트리거 조건 JSON" },
  { name: "handlingActionJson", label: "처리 액션 JSON" },
  { name: "evidenceJson", label: "근거 JSON" },
  { name: "metaJson", label: "메타 JSON" },
] as const satisfies ReadonlyArray<
  Readonly<{ name: FieldPath<RiskEditFormValues>; label: string }>
>;

export function RiskJsonFields() {
  const { control } = useFormContext<RiskEditFormValues>();

  return (
    <>
      {JSON_FIELDS.map((jsonField) => (
        <JsonFormField<RiskEditFormValues>
          key={jsonField.name}
          control={control}
          name={jsonField.name}
          label={jsonField.label}
        />
      ))}
    </>
  );
}
