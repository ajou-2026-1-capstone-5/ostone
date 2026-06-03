import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { ApiRequestError } from "@/shared/api";
import type { SubscriptionResponse } from "@/entities/billing";

import { useCancelSubscription } from "../api/useCancelSubscription";
import { SUBSCRIPTION_CANCEL_ERROR_MESSAGES } from "../api/messages";
import styles from "./cancel-subscription.module.css";

interface CancelSubscriptionButtonProps {
  workspaceId: number;
}

/** 구독 취소 CTA + 확인 다이얼로그. DELETE /subscription. */
export function CancelSubscriptionButton({ workspaceId }: CancelSubscriptionButtonProps) {
  const [open, setOpen] = useState(false);
  const cancel = useCancelSubscription();

  const handleConfirm = () => {
    cancel.mutate(
      { workspaceId },
      {
        onSuccess: (updated: SubscriptionResponse | undefined) => {
          toast.success(
            updated?.status === "CANCELED"
              ? "구독을 해지했습니다."
              : "현재 결제 주기가 끝나면 구독이 해지됩니다.",
          );
          setOpen(false);
        },
        onError: (error: unknown) => {
          if (error instanceof ApiRequestError) {
            if (error.code === "WORKSPACE_ACCESS_DENIED") {
              toast.error(SUBSCRIPTION_CANCEL_ERROR_MESSAGES.WORKSPACE_ACCESS_DENIED);
              return;
            }
            if (error.code === "SUBSCRIPTION_NOT_FOUND") {
              toast.error(SUBSCRIPTION_CANCEL_ERROR_MESSAGES.SUBSCRIPTION_NOT_FOUND);
              return;
            }
          }
          toast.error(SUBSCRIPTION_CANCEL_ERROR_MESSAGES.CANCEL_FAILED);
        },
      },
    );
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="rounded-full px-5"
        onClick={() => setOpen(true)}
      >
        구독 해지
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>구독을 해지할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            현재 결제 주기가 끝나면 구독이 해지되고 다음 결제가 진행되지 않습니다. 주기가 끝나기
            전까지는 계속 이용할 수 있습니다.
          </AlertDialogDescription>
          <AlertDialogFooter className={styles.buttonRow}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={cancel.isPending}
            >
              닫기
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={cancel.isPending}>
              {cancel.isPending ? "처리 중…" : "구독 해지"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
