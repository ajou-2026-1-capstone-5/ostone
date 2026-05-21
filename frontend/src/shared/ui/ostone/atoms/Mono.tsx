import type { ReactNode } from "react";

interface MonoProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Mono({ children, className, style }: MonoProps) {
  return (
    <span
      className={className}
      style={{
        fontFamily: "var(--mono)",
        fontVariantNumeric: "tabular-nums",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
