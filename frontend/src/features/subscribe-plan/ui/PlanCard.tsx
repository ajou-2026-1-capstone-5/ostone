import type { ReactNode } from "react";
import { Check } from "lucide-react";

import { formatAmount, PRO_PLAN } from "@/entities/billing";

import styles from "./plan-card.module.css";

const PLAN_FEATURES = [
  "워크스페이스 전체 멤버 이용",
  "도메인팩 생성·검토 무제한",
  "월 단위 자동결제 · 언제든 해지",
];

interface PlanCardProps {
  /** 구독 시작/카드 등록 CTA 를 page 가 주입한다. */
  action: ReactNode;
  note?: string;
}

/** 단일 Pro 플랜 표시 (U-001=A). plan 목록 API 미사용, FE 상수만 사용. */
export function PlanCard({ action, note }: PlanCardProps) {
  return (
    <section className={styles.card} aria-label="요금제">
      <span className={styles.eyebrow}>구독 플랜</span>
      <h2 className={styles.name}>{PRO_PLAN.name}</h2>
      <div className={styles.priceRow}>
        <span className={styles.price}>{formatAmount(PRO_PLAN.amount, PRO_PLAN.currency)}</span>
        <span className={styles.period}>/ 월</span>
      </div>
      <ul className={styles.features}>
        {PLAN_FEATURES.map((feature) => (
          <li key={feature} className={styles.feature}>
            <Check className={styles.featureMark} size={16} aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>
      <div className={styles.action}>{action}</div>
      {note ? <p className={styles.note}>{note}</p> : null}
    </section>
  );
}
