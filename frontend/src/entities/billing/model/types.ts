export type {
  BillingAuthorizationRequest,
  BillingAuthorizationResponse,
  BillingKeyResponse,
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreateSubscriptionRequest,
  PaymentResponse,
  SubscriptionResponse,
} from "@/shared/api/generated/zod";

/** issue #488 SubscriptionStatus 와 1:1. unknown 값은 방어적으로 처리한다(U-007). */
export type SubscriptionStatus = "INCOMPLETE" | "ACTIVE" | "PAST_DUE" | "CANCELED";

/** issue #488 PaymentStatus(Toss v2 매핑) 와 1:1. unknown 값은 방어적으로 처리한다(U-007). */
export type PaymentStatus =
  | "READY"
  | "IN_PROGRESS"
  | "DONE"
  | "CANCELED"
  | "PARTIAL_CANCELED"
  | "ABORTED"
  | "EXPIRED";
