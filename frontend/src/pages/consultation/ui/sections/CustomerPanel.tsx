import { Pill } from "@/shared/ui/ostone/atoms";
import styles from "./CustomerPanel.module.css";
import { InfoCard } from "./InfoCard";
import { InfoRow } from "./InfoRow";
import { ProgressStepper, type ProgressStepperStep } from "./ProgressStepper";

export interface CustomerInfo {
  name: string;
  channel: string;
  membershipTier?: string | null;
  contact?: string | null;
  email?: string | null;
  handoffRequired?: boolean;
  handoffReason?: string;
  handoffAt?: string | null;
}

export interface CustomerOrderInfo {
  orderNumber?: string | null;
  orderDate?: string | null;
  paymentAmount?: string | null;
  deliveryStatus?: string | null;
}

export interface CustomerExtractedInfo {
  cardNumber?: string | null;
  refundAmount?: string | null;
  refundReason?: string | null;
  dueDate?: string | null;
}

interface CustomerPanelProps {
  customer: CustomerInfo | null;
  orderInfo?: CustomerOrderInfo | null;
  extractedInfo?: CustomerExtractedInfo | null;
  workflowSteps?: ProgressStepperStep[] | null;
  memo: string;
  onMemoChange: (memo: string) => void;
  onMemoSave?: () => void;
  isMemoSaving?: boolean;
}

const EMPTY_CUSTOMER_FIELD = "확인된 정보 없음";

function hasText(value?: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function displayText(value?: string | null, fallback = EMPTY_CUSTOMER_FIELD) {
  return hasText(value) ? value.trim() : fallback;
}

function hasOrderInfo(orderInfo?: CustomerOrderInfo | null) {
  return (
    hasText(orderInfo?.orderNumber) ||
    hasText(orderInfo?.orderDate) ||
    hasText(orderInfo?.paymentAmount) ||
    hasText(orderInfo?.deliveryStatus)
  );
}

function hasExtractedInfo(extractedInfo?: CustomerExtractedInfo | null) {
  return (
    hasText(extractedInfo?.cardNumber) ||
    hasText(extractedInfo?.refundAmount) ||
    hasText(extractedInfo?.refundReason) ||
    hasText(extractedInfo?.dueDate)
  );
}

function EmptyCardState({ children }: { children: string }) {
  return (
    <div
      style={{
        padding: "12px 10px",
        border: "1px solid var(--line-2)",
        borderRadius: "var(--r-2)",
        background: "var(--paper-2)",
        color: "var(--ink-3)",
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

export function CustomerPanel({
  customer,
  orderInfo = null,
  extractedInfo = null,
  workflowSteps = null,
  memo,
  onMemoChange,
  onMemoSave,
  isMemoSaving = false,
}: CustomerPanelProps) {
  const isMemoSaveDisabled = isMemoSaving || !memo.trim() || !onMemoSave;

  if (!customer) {
    return (
      <div
        data-testid="customer-panel-empty"
        style={{
          width: 320,
          flexShrink: 0,
          background: "var(--paper-2)",
          overflow: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            color: "var(--ink-3)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          고객을 선택하면 정보가 표시됩니다
        </span>
      </div>
    );
  }

  return (
    <div
      data-testid="customer-panel"
      style={{
        width: 320,
        flexShrink: 0,
        background: "var(--paper-2)",
        overflow: "auto",
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <InfoCard title="고객 정보">
        <InfoRow label="이름" value={customer.name} />
        {hasText(customer.membershipTier) && (
          <InfoRow label="회원 등급" value={customer.membershipTier.trim()} tone="signal" />
        )}
        <InfoRow label="연락처" value={displayText(customer.contact)} />
        <InfoRow label="이메일" value={displayText(customer.email)} />
      </InfoCard>

      {customer.handoffRequired && (
        <InfoCard title="상담사 확인 필요" meta="HANDOFF">
          <InfoRow label="상태" tone="warn" value={<Pill tone="warn">상담사 확인 필요</Pill>} />
          <InfoRow label="사유" value={customer.handoffReason || "상담원 확인이 필요합니다."} />
          <InfoRow label="발생 시각" value={customer.handoffAt || "기록 없음"} />
        </InfoCard>
      )}

      <InfoCard title="문의 관련 주문" meta={displayText(orderInfo?.orderNumber, "연동 정보 없음")}>
        {hasOrderInfo(orderInfo) ? (
          <>
            <InfoRow
              label="주문번호"
              value={displayText(orderInfo?.orderNumber, "연동 정보 없음")}
            />
            <InfoRow label="주문일" value={displayText(orderInfo?.orderDate, "연동 정보 없음")} />
            <InfoRow
              label="결제금액"
              value={displayText(orderInfo?.paymentAmount, "연동 정보 없음")}
            />
            <InfoRow
              label="상태"
              tone={hasText(orderInfo?.deliveryStatus) ? "signal" : "default"}
              value={
                hasText(orderInfo?.deliveryStatus) ? (
                  <Pill tone="signal">{orderInfo.deliveryStatus.trim()}</Pill>
                ) : (
                  "연동 정보 없음"
                )
              }
            />
          </>
        ) : (
          <EmptyCardState>연동된 주문 정보가 없습니다.</EmptyCardState>
        )}
      </InfoCard>

      <InfoCard
        title="처리 단계"
        meta={workflowSteps?.length ? `${workflowSteps.length} 단계` : "연동 정보 없음"}
      >
        {workflowSteps?.length ? (
          <ProgressStepper steps={workflowSteps} />
        ) : (
          <EmptyCardState>확인된 처리 단계가 없습니다.</EmptyCardState>
        )}
      </InfoCard>

      <InfoCard title="확인된 정보" meta="자동 발췌">
        {hasExtractedInfo(extractedInfo) ? (
          <>
            <InfoRow
              label="카드번호"
              value={displayText(extractedInfo?.cardNumber, "확인된 정보 없음")}
            />
            <InfoRow
              label="환불 요청액"
              value={displayText(extractedInfo?.refundAmount, "확인된 정보 없음")}
              tone={hasText(extractedInfo?.refundAmount) ? "warn" : "default"}
            />
            <InfoRow
              label="환불 사유"
              value={displayText(extractedInfo?.refundReason, "확인된 정보 없음")}
            />
            <InfoRow
              label="처리 기한"
              value={displayText(extractedInfo?.dueDate, "확인된 정보 없음")}
              tone={hasText(extractedInfo?.dueDate) ? "danger" : "default"}
            />
          </>
        ) : (
          <EmptyCardState>자동 발췌로 확인된 정보가 없습니다.</EmptyCardState>
        )}
      </InfoCard>

      <InfoCard title="내부 메모" meta="NOTE 메시지" style={{ padding: "14px 14px 14px" }}>
        <div className={styles.memoComposer}>
          <textarea
            data-testid="customer-memo-textarea"
            className={styles.memoTextarea}
            value={memo}
            onChange={(e) => onMemoChange(e.target.value)}
            placeholder="타임라인에 내부 메모로 남길 내용을 입력하세요..."
            aria-label="내부 메모 입력"
          />
          <button
            type="button"
            data-testid="customer-memo-save"
            className={styles.memoSaveButton}
            onClick={onMemoSave}
            disabled={isMemoSaveDisabled}
          >
            {isMemoSaving ? "남기는 중..." : "내부 메모로 남기기"}
          </button>
        </div>
      </InfoCard>
    </div>
  );
}
