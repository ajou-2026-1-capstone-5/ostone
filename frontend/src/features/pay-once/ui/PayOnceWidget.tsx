import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk";

import { Button } from "@/shared/ui/button";
import { LoadingSpinner } from "@/shared/ui/ostone/atoms/LoadingSpinner";
import { formatAmount, PRO_PLAN } from "@/entities/billing";
import { loadToss, isTossClientKeyConfigured } from "@/shared/lib/toss/loadToss";
import {
  buildBillingFailUrl,
  buildBillingSuccessUrl,
  BILLING_FLOW,
} from "@/shared/lib/billingRoutes";

import { PAY_ONCE_ERROR_MESSAGES } from "../api/messages";

import styles from "./pay-once.module.css";

const PAYMENT_METHODS_SELECTOR = "toss-payment-methods";
const AGREEMENT_SELECTOR = "toss-agreement";
const ORDER_NAME = "ostone Pro 일회성 결제";

interface PayOnceWidgetProps {
  workspaceId: number;
  customerKey: string;
}

/**
 * 위젯 일회성 결제 (U-003=B). orderId 는 FE 가 crypto.randomUUID() 로 생성해 requestPayment 와 confirm 에
 * 동일하게 사용한다. 금액은 BE expected-amount 검증에 의존한다.
 */
export function PayOnceWidget({ workspaceId, customerKey }: PayOnceWidgetProps) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const widgetsRef = useRef<TossPaymentsWidgets | null>(null);
  const orderIdRef = useRef<string>("");
  const clientKeyMissing = !isTossClientKeyConfigured();

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    if (!orderIdRef.current) {
      orderIdRef.current = crypto.randomUUID();
    }

    void (async () => {
      try {
        const toss = await loadToss();
        const widgets = toss.widgets({ customerKey });
        await widgets.setAmount({ currency: "KRW", value: PRO_PLAN.amount });
        await Promise.all([
          widgets.renderPaymentMethods({ selector: `#${PAYMENT_METHODS_SELECTOR}` }),
          widgets.renderAgreement({ selector: `#${AGREEMENT_SELECTOR}` }),
        ]);
        if (!cancelled) {
          widgetsRef.current = widgets;
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          toast.error(PAY_ONCE_ERROR_MESSAGES.WIDGET_FAILED);
          setOpen(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, customerKey]);

  const handleRequestPayment = async () => {
    if (!widgetsRef.current) {
      return;
    }
    setRequesting(true);
    try {
      await widgetsRef.current.requestPayment({
        orderId: orderIdRef.current,
        orderName: ORDER_NAME,
        successUrl: buildBillingSuccessUrl(workspaceId, BILLING_FLOW.widget),
        failUrl: buildBillingFailUrl(workspaceId, BILLING_FLOW.widget),
      });
      // requestPayment 성공 시 외부 결제창으로 리다이렉트되어 이후 코드는 실행되지 않는다.
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "USER_CANCEL"
      ) {
        setRequesting(false);
        return;
      }
      toast.error(PAY_ONCE_ERROR_MESSAGES.WIDGET_FAILED);
      setRequesting(false);
    }
  };

  return (
    <section className={styles.card} aria-label="일회성 결제">
      <div className={styles.header}>
        <h2 className={styles.title}>일회성 결제</h2>
        <p className={styles.subtitle}>
          정기 구독과 별개로 {formatAmount(PRO_PLAN.amount, PRO_PLAN.currency)}을 결제 위젯으로 단건
          결제합니다.
        </p>
      </div>

      {!open ? (
        <div className={styles.footer}>
          <Button
            type="button"
            variant="outline"
            className="rounded-full px-6"
            disabled={clientKeyMissing}
            onClick={() => setOpen(true)}
          >
            결제 진행
          </Button>
        </div>
      ) : (
        <>
          <div id={PAYMENT_METHODS_SELECTOR} className={styles.widgetMount} />
          <div id={AGREEMENT_SELECTOR} className={styles.widgetMount} />
          {!ready ? (
            <div className={styles.loading} aria-live="polite">
              <LoadingSpinner />
              결제 위젯을 불러오는 중입니다.
            </div>
          ) : null}
          <div className={styles.footer}>
            <Button
              type="button"
              className="rounded-full px-6"
              disabled={!ready || requesting}
              onClick={() => void handleRequestPayment()}
            >
              {requesting
                ? "결제창으로 이동 중…"
                : `${formatAmount(PRO_PLAN.amount, PRO_PLAN.currency)} 결제하기`}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
