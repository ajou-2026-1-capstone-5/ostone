import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/shared/ui/form";
import { JsonTextarea } from "./JsonTextarea";
import type { PolicyEditFormValues } from "../model/schema";

const JSON_FIELDS: ReadonlyArray<
  Readonly<{
    name: keyof Pick<
      PolicyEditFormValues,
      "conditionJson" | "actionJson" | "evidenceJson" | "metaJson"
    >;
    label: string;
  }>
> = [
  { name: "conditionJson", label: "조건 JSON" },
  { name: "actionJson", label: "액션 JSON" },
  { name: "evidenceJson", label: "근거 JSON" },
  { name: "metaJson", label: "메타 JSON" },
];

export function PolicyJsonFields() {
  const { control } = useFormContext<PolicyEditFormValues>();

  return (
    <>
      {JSON_FIELDS.map((jsonField) => (
        <FormField
          key={jsonField.name}
          control={control}
          name={jsonField.name}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{jsonField.label}</FormLabel>
              <FormControl>
                <JsonTextarea {...field} aria-label={jsonField.label} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ))}
    </>
  );
}
