import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/shared/ui/form";
import { JsonTextarea } from "./JsonTextarea";
import type { PolicyEditFormValues } from "../model/schema";

export function PolicyJsonFields() {
  const { control } = useFormContext<PolicyEditFormValues>();

  return (
    <>
      <FormField
        control={control}
        name="conditionJson"
        render={({ field }) => (
          <FormItem>
            <FormLabel>조건 JSON</FormLabel>
            <FormControl>
              <JsonTextarea {...field} aria-label="조건 JSON" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="actionJson"
        render={({ field }) => (
          <FormItem>
            <FormLabel>액션 JSON</FormLabel>
            <FormControl>
              <JsonTextarea {...field} aria-label="액션 JSON" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="evidenceJson"
        render={({ field }) => (
          <FormItem>
            <FormLabel>근거 JSON</FormLabel>
            <FormControl>
              <JsonTextarea {...field} aria-label="근거 JSON" />
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
            <FormLabel>메타 JSON</FormLabel>
            <FormControl>
              <JsonTextarea {...field} aria-label="메타 JSON" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
