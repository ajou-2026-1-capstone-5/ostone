import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createSubscription } from "@/shared/api/generated/endpoints/subscription-controller/subscription-controller";
import { ApiRequestError, billingQueryKeys, selectApiData } from "@/shared/api";
import { deriveCustomerKey, PRO_PLAN, type SubscriptionResponse } from "@/entities/billing";
import { loadToss, TossClientKeyMissingError } from "@/shared/lib/toss/loadToss";
import {
  buildBillingFailUrl,
  buildBillingSuccessUrl,
  BILLING_FLOW,
} from "@/shared/lib/billingRoutes";

import { BILLING_REGISTER_ERROR_MESSAGES } from "./messages";

interface RegisterBillingParams {
  workspaceId: number;
  /** 현재 구독(없으면 null). INCOMPLETE 면 그대로 customerKey 재사용, 없으면 먼저 생성한다. */
  subscription: SubscriptionResponse | null;
}

/** 사용자가 자동결제 인증창을 닫은 경우(USER_CANCEL)는 에러 토스트를 띄우지 않는다. */
function isUserCancel(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "USER_CANCEL"
  );
}

/**
 * 자동결제 카드 등록 시작. INCOMPLETE 구독이 없으면 먼저 POST /subscription 으로 구독을 만들고(백엔드가
 * customerKey 부여), Toss `requestBillingAuth` 로 카드 등록창을 띄운다. 성공 시 /billing/success 로 리다이렉트되어
 * POST /billing/authorizations 로 구독이 활성화된다.
 */
export function useRegisterBilling() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId, subscription }: RegisterBillingParams) => {
      let serverCustomerKey = subscription?.customerKey ?? null;

      if (!subscription) {
        const res = await createSubscription(workspaceId, { planKey: PRO_PLAN.planKey });
        const created = selectApiData(res) as SubscriptionResponse | undefined;
        serverCustomerKey = created?.customerKey ?? null;
        queryClient.setQueryData(billingQueryKeys.subscription(workspaceId), created ?? null);
      }

      const customerKey = deriveCustomerKey(workspaceId, serverCustomerKey);
      const toss = await loadToss();
      const payment = toss.payment({ customerKey });

      // requestBillingAuth 는 외부 결제창으로 리다이렉트되므로 이후 코드는 실행되지 않는다.
      await payment.requestBillingAuth({
        method: "CARD",
        successUrl: buildBillingSuccessUrl(workspaceId, BILLING_FLOW.billing),
        failUrl: buildBillingFailUrl(workspaceId, BILLING_FLOW.billing),
      });
    },
    onError: (error: unknown) => {
      if (isUserCancel(error)) {
        return;
      }
      if (error instanceof TossClientKeyMissingError) {
        toast.error(BILLING_REGISTER_ERROR_MESSAGES.CLIENT_KEY_MISSING);
        return;
      }
      if (error instanceof ApiRequestError) {
        if (error.code === "SUBSCRIPTION_ALREADY_EXISTS") {
          toast.error(BILLING_REGISTER_ERROR_MESSAGES.SUBSCRIPTION_ALREADY_EXISTS);
          return;
        }
        if (error.code === "PLAN_NOT_FOUND") {
          toast.error(BILLING_REGISTER_ERROR_MESSAGES.PLAN_NOT_FOUND);
          return;
        }
        if (error.code === "WORKSPACE_ACCESS_DENIED") {
          toast.error(BILLING_REGISTER_ERROR_MESSAGES.WORKSPACE_ACCESS_DENIED);
          return;
        }
      }
      toast.error(BILLING_REGISTER_ERROR_MESSAGES.REGISTER_FAILED);
    },
  });
}
