import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/utils";
import { Textarea } from "@/shared/ui/textarea";

type JsonTextareaProps = ComponentProps<typeof Textarea>;

export function JsonTextarea({ className, ...textareaProps }: JsonTextareaProps) {
  return (
    <Textarea
      {...textareaProps}
      spellCheck={false}
      className={cn("min-h-32 resize-y font-mono text-xs leading-relaxed", className)}
    />
  );
}
