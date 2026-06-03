import type { StatusVariant } from "../model/status";

import styles from "./billing.module.css";

const VARIANT_CLASS: Record<StatusVariant, string> = {
  solid: styles.badgeSolid,
  outline: styles.badgeOutline,
  muted: styles.badgeMuted,
};

interface StatusBadgeProps {
  label: string;
  variant: StatusVariant;
}

/** 흑백 status 배지 (DESIGN.md — 컬러 금지, weight/보더로 위계). */
export function StatusBadge({ label, variant }: StatusBadgeProps) {
  return <span className={`${styles.badge} ${VARIANT_CLASS[variant]}`}>{label}</span>;
}
