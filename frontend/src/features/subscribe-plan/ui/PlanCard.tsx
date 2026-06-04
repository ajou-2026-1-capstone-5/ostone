import type { ReactNode } from "react";
import { Check } from "lucide-react";

import styles from "./plan-card.module.css";

export interface PlanCardProps {
  name: string;
  /** 표시용 가격 라벨(예: "29,000원" 또는 contactOnly 시 "문의"). */
  priceLabel: string;
  /** 가격 뒤 기간 표기(예: "/ 월"). contactOnly면 생략한다. */
  periodLabel?: string;
  tagline?: string;
  features: string[];
  /** "인기" 배지 표시. */
  popular?: boolean;
  /** 현재 플랜 여부("현재 플랜" 태그 표시). */
  current?: boolean;
  /** 가격 대신 문의형으로 표시(Enterprise). */
  contactOnly?: boolean;
  /** 구독 시작/문의 CTA 를 page 가 주입한다. */
  action: ReactNode;
}

/** 단일 요금제 카드(presentational). 4개 티어를 동일 컴포넌트로 렌더한다. */
export function PlanCard({
  name,
  priceLabel,
  periodLabel,
  tagline,
  features,
  popular = false,
  current = false,
  contactOnly = false,
  action,
}: PlanCardProps) {
  return (
    <section
      className={popular ? `${styles.card} ${styles.cardPopular}` : styles.card}
      aria-label={`${name} 요금제`}
    >
      <span className={styles.eyebrow}>Plan</span>
      <div className={styles.nameRow}>
        <h3 className={styles.name}>{name}</h3>
        {popular ? (
          <span className={styles.badge}>인기</span>
        ) : current ? (
          <span className={styles.currentTag}>현재 플랜</span>
        ) : null}
      </div>
      <div className={styles.priceRow}>
        <span className={contactOnly ? styles.priceContact : styles.price}>{priceLabel}</span>
        {!contactOnly && periodLabel ? <span className={styles.period}>{periodLabel}</span> : null}
      </div>
      {tagline ? <p className={styles.tagline}>{tagline}</p> : null}
      <ul className={styles.features}>
        {features.map((feature) => (
          <li key={feature} className={styles.feature}>
            <Check className={styles.featureMark} size={16} aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>
      <div className={styles.action}>{action}</div>
    </section>
  );
}
