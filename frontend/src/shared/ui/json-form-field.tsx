import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { JsonTextarea } from "@/shared/ui/json-textarea";

interface JsonFormFieldProps<TValues extends FieldValues> {
  control: Control<TValues>;
  name: FieldPath<TValues>;
  label: string;
}

export function JsonFormField<TValues extends FieldValues>({
  control,
  name,
  label,
}: Readonly<JsonFormFieldProps<TValues>>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <JsonTextarea
              {...field}
              aria-label={label}
              value={typeof field.value === "string" ? field.value : ""}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
