import { formatAmount, formatDate } from "../lib/format";
import { getSubscriptionStatusMeta } from "../model/status";
import { PRO_PLAN } from "../model/plans";
import type { SubscriptionResponse } from "../model/types";
import { StatusBadge } from "./StatusBadge";

import styles from "./billing.module.css";

interface SubscriptionStatusCardProps {
  subscription: SubscriptionResponse;
}

/** 구독 상태/플랜/결제 주기 표시. customerKey 등 민감 식별자는 화면에 노출하지 않는다. */
export function SubscriptionStatusCard({ subscription }: SubscriptionStatusCardProps) {
  const meta = getSubscriptionStatusMeta(subscription.status);
  const planName = subscription.planKey === PRO_PLAN.planKey ? PRO_PLAN.name : subscription.planKey;

  return (
    <section className={styles.card} aria-label="구독 상태">
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>구독</h2>
        <StatusBadge label={meta.label} variant={meta.variant} />
      </div>
      <dl className={styles.defRows}>
        <dt className={styles.defTerm}>플랜</dt>
        <dd className={styles.defValue}>
          {planName} · {formatAmount(PRO_PLAN.amount, PRO_PLAN.currency)} / 월
        </dd>
        <dt className={styles.defTerm}>현재 주기</dt>
        <dd className={styles.defValue}>
          {formatDate(subscription.currentPeriodStart)} ~{" "}
          {formatDate(subscription.currentPeriodEnd)}
        </dd>
        <dt className={styles.defTerm}>다음 결제일</dt>
        <dd className={styles.defValue}>{formatDate(subscription.currentPeriodEnd)}</dd>
        {subscription.cancelAtPeriodEnd ? (
          <>
            <dt className={styles.defTerm}>해지 예약</dt>
            <dd className={styles.defValue}>
              현재 주기 종료일({formatDate(subscription.currentPeriodEnd)})에 해지됩니다.
            </dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}
