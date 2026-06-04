import type { ReactNode } from "react";

import { FREE_PLAN_KEY, PLAN_COPY, formatAmount, type PlanCatalogEntry } from "@/entities/billing";

import { PlanCard } from "./PlanCard";
import styles from "./plan-card.module.css";

export interface PlanComparisonEntry {
  planKey: string;
  contactOnly: boolean;
  current: boolean;
}

export interface PlanComparisonProps {
  catalog: PlanCatalogEntry[];
  /** 현재 활성/진행 중 구독의 planKey. 미구독이면 null → Free 가 현재 플랜. */
  currentPlanKey: string | null;
  /** 각 카드의 CTA 를 page 가 주입한다(FSD: feature 간 직접 import 금지). */
  renderAction: (entry: PlanComparisonEntry) => ReactNode;
}

interface CardModel {
  planKey: string;
  name: string;
  priceLabel: string;
  periodLabel?: string;
  tagline?: string;
  features: string[];
  popular: boolean;
  contactOnly: boolean;
}

/** 결제 주기 라벨. 알 수 없는 interval 은 잘못된 라벨 대신 미표시(undefined). */
const PERIOD_LABEL_BY_INTERVAL: Record<string, string> = {
  MONTH: "/ 월",
  YEAR: "/ 년",
};

function periodLabelFor(interval: string): string | undefined {
  return PERIOD_LABEL_BY_INTERVAL[interval];
}

const FREE_CARD: CardModel = {
  planKey: FREE_PLAN_KEY,
  name: PLAN_COPY[FREE_PLAN_KEY].name,
  priceLabel: formatAmount(0, "KRW"),
  periodLabel: periodLabelFor("MONTH"),
  tagline: PLAN_COPY[FREE_PLAN_KEY].tagline,
  features: PLAN_COPY[FREE_PLAN_KEY].features,
  popular: false,
  contactOnly: false,
};

function toCardModel(entry: PlanCatalogEntry): CardModel {
  const copy = PLAN_COPY[entry.planKey];
  return {
    planKey: entry.planKey,
    name: copy?.name ?? entry.name,
    priceLabel: entry.contactOnly ? "문의" : formatAmount(entry.amount, entry.currency),
    periodLabel: entry.contactOnly ? undefined : periodLabelFor(entry.interval),
    tagline: copy?.tagline,
    features: copy?.features ?? [],
    popular: copy?.popular ?? false,
    contactOnly: entry.contactOnly,
  };
}

/** Free + 카탈로그 요금제를 비교 그리드로 렌더한다. */
export function PlanComparison({ catalog, currentPlanKey, renderAction }: PlanComparisonProps) {
  const effectiveCurrent = currentPlanKey ?? FREE_PLAN_KEY;
  // 표시 순서: Free → 유료(가격 오름차순) → contact-only(Enterprise) 마지막.
  // 백엔드는 amount 오름차순이라 amount 0인 Enterprise가 앞서므로 표시 계층에서 정렬한다.
  const ordered = [...catalog].sort(
    (a, b) => Number(a.contactOnly) - Number(b.contactOnly) || a.amount - b.amount,
  );
  const cards: CardModel[] = [FREE_CARD, ...ordered.map(toCardModel)];

  return (
    <div className={styles.grid} aria-label="요금제 비교">
      {cards.map((card) => {
        const current = card.planKey === effectiveCurrent;
        return (
          <PlanCard
            key={card.planKey}
            name={card.name}
            priceLabel={card.priceLabel}
            periodLabel={card.periodLabel}
            tagline={card.tagline}
            features={card.features}
            popular={card.popular}
            current={current}
            contactOnly={card.contactOnly}
            action={renderAction({
              planKey: card.planKey,
              contactOnly: card.contactOnly,
              current,
            })}
          />
        );
      })}
    </div>
  );
}
