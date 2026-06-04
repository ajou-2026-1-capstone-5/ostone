import { Button } from "@/shared/ui/button";
import { isTossClientKeyConfigured } from "@/shared/lib/toss/loadToss";
import type { SubscriptionResponse } from "@/entities/billing";

import { useRegisterBilling } from "../api/useRegisterBilling";

interface RegisterBillingButtonProps {
  workspaceId: number;
  subscription: SubscriptionResponse | null;
  /** 선택한 요금제 planKey. 미지정 시 기본 Pro. */
  planKey?: string;
  label?: string;
}

/** 자동결제 카드 등록 CTA. 클릭 시 구독 생성(필요 시) → Toss 카드 등록창 리다이렉트. */
export function RegisterBillingButton({
  workspaceId,
  subscription,
  planKey,
  label = "카드 등록하고 구독 시작",
}: RegisterBillingButtonProps) {
  const register = useRegisterBilling();
  const clientKeyMissing = !isTossClientKeyConfigured();

  return (
    <Button
      type="button"
      className="w-full rounded-full px-6"
      disabled={register.isPending || clientKeyMissing}
      onClick={() => register.mutate({ workspaceId, subscription, planKey })}
    >
      {register.isPending ? "결제창으로 이동 중…" : label}
    </Button>
  );
}
