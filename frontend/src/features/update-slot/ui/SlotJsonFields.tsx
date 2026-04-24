import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/shared/ui/form";
import { JsonTextarea } from "./JsonTextarea";
import type { SlotEditFormValues } from "../model/schema";

export function SlotJsonFields() {
  const { control } = useFormContext<SlotEditFormValues>();

  return (
    <>
      <FormField
        control={control}
        name="validationRuleJson"
        render={({ field }) => (
          <FormItem>
            <FormLabel>유효성 검사 규칙 (JSON)</FormLabel>
            <FormControl>
              <JsonTextarea
                {...field}
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value || null)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="defaultValueJson"
        render={({ field }) => (
          <FormItem>
            <FormLabel>기본값 (JSON)</FormLabel>
            <FormControl>
              <JsonTextarea
                {...field}
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value || null)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="metaJson"
        render={({ field }) => (
          <FormItem>
            <FormLabel>메타 (JSON)</FormLabel>
            <FormControl>
              <JsonTextarea
                {...field}
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value || null)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
