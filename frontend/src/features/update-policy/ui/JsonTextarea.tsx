import { Textarea } from "@/shared/ui/textarea";
import type { ComponentProps } from "react";

type JsonTextareaProps = ComponentProps<typeof Textarea>;

export function JsonTextarea({ className, ...props }: JsonTextareaProps) {
  return (
    <Textarea
      className={`min-h-32 resize-y font-mono text-xs leading-relaxed ${className ?? ""}`}
      spellCheck={false}
      {...props}
    />
  );
}
