import type { BillingKeyResponse } from "../model/types";

import styles from "./billing.module.css";

interface BillingMethodCardProps {
  /** POST /billing/authorizations 직후에만 전달된다(GET 으로는 재조회 불가). */
  billingKey?: BillingKeyResponse | null;
  /** billingKey 가 없을 때 최근 결제의 method 를 대체 표기. */
  fallbackMethod?: string;
}

/** 등록된 자동결제 수단 표시(카드사·마스킹 번호). billingKey 자체는 서버에만 있고 노출하지 않는다. */
export function BillingMethodCard({ billingKey, fallbackMethod }: BillingMethodCardProps) {
  return (
    <section className={styles.card} aria-label="결제수단">
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>결제수단</h2>
      </div>
      {billingKey?.cardCompany ? (
        <div className={styles.methodLine}>
          <span className={styles.methodCompany}>{billingKey.cardCompany}</span>
          <span className={styles.methodMasked}>{billingKey.cardNumberMasked ?? ""}</span>
        </div>
      ) : fallbackMethod ? (
        <div className={styles.methodLine}>
          <span className={styles.methodCompany}>{fallbackMethod}</span>
        </div>
      ) : (
        <p className={styles.muted}>자동결제 수단이 등록되어 있습니다.</p>
      )}
    </section>
  );
}
