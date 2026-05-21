import type { ReactNode } from "react";

interface EyebrowProps {
  children: ReactNode;
  className?: string;
}

export function Eyebrow({ children, className }: EyebrowProps) {
  return <span className={`t-eyebrow${className ? ` ${className}` : ""}`}>{children}</span>;
}
