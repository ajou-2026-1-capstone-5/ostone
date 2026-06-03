import type { ReactNode } from "react";

import { formatAmount, formatDate } from "../lib/format";
import { getPaymentStatusMeta } from "../model/status";
import type { PaymentResponse } from "../model/types";
import { StatusBadge } from "./StatusBadge";

import styles from "./billing.module.css";

interface PaymentHistoryListProps {
  payments: PaymentResponse[];
  /** 행별 부가 액션(예: 환불 버튼)을 page/feature 가 주입한다(entity → feature 의존 방지). */
  renderActions?: (payment: PaymentResponse) => ReactNode;
}

/** 결제 내역 + 영수증(receiptUrl) 링크. */
export function PaymentHistoryList({ payments, renderActions }: PaymentHistoryListProps) {
  return (
    <section className={styles.card} aria-label="결제 내역">
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>결제 내역</h2>
      </div>
      <table className={styles.historyTable}>
        <thead>
          <tr>
            <th scope="col">일시</th>
            <th scope="col">금액</th>
            <th scope="col">상태</th>
            <th scope="col">영수증</th>
            {renderActions ? <th scope="col">관리</th> : null}
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => {
            const meta = getPaymentStatusMeta(payment.status);
            return (
              <tr key={payment.id ?? payment.orderId ?? payment.paymentKey}>
                <td>{formatDate(payment.approvedAt ?? payment.createdAt)}</td>
                <td className={styles.amountCell}>
                  {formatAmount(payment.amount, payment.currency)}
                </td>
                <td>
                  <StatusBadge label={meta.label} variant={meta.variant} />
                </td>
                <td>
                  {payment.receiptUrl ? (
                    <a
                      className={styles.receiptLink}
                      href={payment.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      영수증 보기
                    </a>
                  ) : (
                    <span className={styles.muted}>-</span>
                  )}
                </td>
                {renderActions ? (
                  <td className={styles.actionsCell}>{renderActions(payment)}</td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
