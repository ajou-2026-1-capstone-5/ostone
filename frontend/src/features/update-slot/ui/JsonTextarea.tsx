import { Textarea } from "@/shared/ui/textarea";
import type { ComponentProps } from "react";

type JsonTextareaProps = ComponentProps<typeof Textarea>;

export function JsonTextarea(props: JsonTextareaProps) {
  return <Textarea {...props} />;
}
