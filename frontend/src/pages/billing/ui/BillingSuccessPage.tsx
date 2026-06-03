import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { ApiRequestError } from "@/shared/api";
import { buildWorkspaceBillingPath, BILLING_FLOW } from "@/shared/lib/billingRoutes";
import { LoadingSpinner } from "@/shared/ui/ostone/atoms/LoadingSpinner";
import { Button } from "@/shared/ui/button";
import {
  BILLING_CONFIRM_ERROR_MESSAGES,
  useConfirmBillingAuthorization,
} from "@/features/register-billing-method";
import {
  PAY_ONCE_ERROR_MESSAGES,
  isOrderProcessed,
  markOrderProcessed,
  useConfirmPayment,
} from "@/features/pay-once";

import styles from "./billing-landing.module.css";

type LandingStatus = "processing" | "error";

/**
 * 외부 결제창 복귀 랜딩(빌링/위젯 공통). 수신한 authKey/paymentKey 는 즉시 서버로 전달만 하고 저장/로깅하지 않는다.
 * 성공하면 구독 화면으로 replace 이동한다. 위젯 흐름은 처리된 orderId 재호출을 가드한다.
 */
export function BillingSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const confirmBilling = useConfirmBillingAuthorization();
  const confirmPayment = useConfirmPayment();
  const processedRef = useRef(false);
  const [status, setStatus] = useState<LandingStatus>("processing");
  const [errorMessage, setErrorMessage] = useState("");

  const workspaceIdRaw = searchParams.get("workspaceId");
  const workspaceId = workspaceIdRaw ? Number(workspaceIdRaw) : NaN;

  useEffect(() => {
    if (processedRef.current) {
      return;
    }
    processedRef.current = true;
    window.history.replaceState(window.history.state, "", window.location.pathname);

    if (!workspaceIdRaw || Number.isNaN(workspaceId)) {
      setStatus("error");
      setErrorMessage("워크스페이스 정보를 확인할 수 없습니다.");
      return;
    }

    const billingPath = buildWorkspaceBillingPath(workspaceId);
    const flow = searchParams.get("flow");
    const authKey = searchParams.get("authKey");
    const customerKey = searchParams.get("customerKey");
    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amountRaw = searchParams.get("amount");

    if (flow === BILLING_FLOW.billing && authKey && customerKey) {
      confirmBilling.mutate(
        { workspaceId, authKey, customerKey },
        {
          onSuccess: (result) => {
            toast.success("구독이 활성화되었습니다.");
            navigate(billingPath, { replace: true, state: { billingKey: result?.billingKey } });
          },
          onError: (error: unknown) => {
            if (error instanceof ApiRequestError && error.code === "SUBSCRIPTION_ALREADY_EXISTS") {
              toast.success("이미 구독이 활성화되어 있습니다.");
              navigate(billingPath, { replace: true });
              return;
            }
            setStatus("error");
            setErrorMessage(resolveBillingError(error));
          },
        },
      );
      return;
    }

    if (flow === BILLING_FLOW.widget && paymentKey && orderId && amountRaw) {
      const amount = Number(amountRaw);
      if (Number.isNaN(amount)) {
        setStatus("error");
        setErrorMessage("결제 금액을 확인할 수 없습니다.");
        return;
      }
      if (isOrderProcessed(orderId)) {
        toast.info("이미 처리된 결제입니다.");
        navigate(billingPath, { replace: true });
        return;
      }
      confirmPayment.mutate(
        { workspaceId, paymentKey, orderId, amount },
        {
          onSuccess: () => {
            markOrderProcessed(orderId);
            toast.success("결제가 완료되었습니다.");
            navigate(billingPath, { replace: true });
          },
          onError: (error: unknown) => {
            setStatus("error");
            setErrorMessage(resolvePaymentError(error));
          },
        },
      );
      return;
    }

    setStatus("error");
    setErrorMessage("결제 결과 정보가 올바르지 않습니다.");
    // confirmBilling/confirmPayment 는 mount 시 1회만 실행한다(처리 가드 보유).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.wrapper}>
      <div className={styles.panel}>
        {status === "processing" ? (
          <>
            <LoadingSpinner />
            <h1 className={styles.title}>결제 결과를 처리하고 있습니다</h1>
            <p className={styles.message}>잠시만 기다려 주세요.</p>
          </>
        ) : (
          <>
            <h1 className={styles.title}>결제 처리에 실패했습니다</h1>
            <p className={styles.message}>{errorMessage}</p>
            <div className={styles.actions}>
              <Button
                type="button"
                className="rounded-full px-6"
                onClick={() =>
                  navigate(
                    Number.isNaN(workspaceId)
                      ? "/workspaces"
                      : buildWorkspaceBillingPath(workspaceId),
                    {
                      replace: true,
                    },
                  )
                }
              >
                구독 화면으로 이동
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function resolveBillingError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    const message =
      BILLING_CONFIRM_ERROR_MESSAGES[error.code as keyof typeof BILLING_CONFIRM_ERROR_MESSAGES];
    if (message) {
      return message;
    }
  }
  return BILLING_CONFIRM_ERROR_MESSAGES.CONFIRM_FAILED;
}

function resolvePaymentError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    const message = PAY_ONCE_ERROR_MESSAGES[error.code as keyof typeof PAY_ONCE_ERROR_MESSAGES];
    if (message) {
      return message;
    }
  }
  return PAY_ONCE_ERROR_MESSAGES.CONFIRM_FAILED;
}
