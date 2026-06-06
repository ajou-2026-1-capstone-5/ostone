import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { ApiRequestError } from "@/shared/api";
import { formatAmount, type PaymentResponse } from "@/entities/billing";

import { useRefundPayment } from "../api/useRefundPayment";
import { REFUND_ERROR_MESSAGES } from "../api/messages";
import styles from "./cancel-subscription.module.css";

interface RefundButtonProps {
  workspaceId: number;
  payment: PaymentResponse;
  onRefunded?: (payment: PaymentResponse | undefined) => void;
}

/** 결제 환불 CTA + 사유 입력 다이얼로그. 전액 환불(cancelAmount 미전송). */
export function RefundButton({ workspaceId, payment, onRefunded }: RefundButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("고객 요청");
  const refund = useRefundPayment();

  const handleConfirm = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      toast.error("환불 사유를 입력해주세요.");
      return;
    }
    if (!payment.paymentKey) {
      toast.error(REFUND_ERROR_MESSAGES.PAYMENT_NOT_FOUND);
      return;
    }
    refund.mutate(
      { workspaceId, paymentKey: payment.paymentKey, cancelReason: trimmed },
      {
        onSuccess: (updated: PaymentResponse | undefined) => {
          toast.success("환불을 요청했습니다.");
          setOpen(false);
          onRefunded?.(updated);
        },
        onError: (error: unknown) => {
          if (error instanceof ApiRequestError) {
            if (error.code === "PAYMENT_CANCEL_NOT_ALLOWED") {
              toast.error(REFUND_ERROR_MESSAGES.PAYMENT_CANCEL_NOT_ALLOWED);
              return;
            }
            if (error.code === "PAYMENT_NOT_FOUND") {
              toast.error(REFUND_ERROR_MESSAGES.PAYMENT_NOT_FOUND);
              return;
            }
            if (error.code === "PAYMENT_GATEWAY_ERROR") {
              toast.error(REFUND_ERROR_MESSAGES.PAYMENT_GATEWAY_ERROR);
              return;
            }
          }
          toast.error(REFUND_ERROR_MESSAGES.REFUND_FAILED);
        },
      },
    );
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="rounded-full"
        onClick={() => setOpen(true)}
      >
        환불
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>결제를 환불할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            {formatAmount(payment.amount, payment.currency)} 결제를 전액 환불합니다.
          </AlertDialogDescription>
          <div className={styles.dialogBody}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>환불 사유</span>
              <Input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="환불 사유를 입력해주세요"
                maxLength={200}
              />
            </label>
          </div>
          <AlertDialogFooter className={styles.buttonRow}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={refund.isPending}
            >
              닫기
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={refund.isPending}>
              {refund.isPending ? "처리 중…" : "환불"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
