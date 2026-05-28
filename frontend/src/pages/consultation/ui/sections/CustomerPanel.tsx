import { Pill } from "@/shared/ui/ostone/atoms";
import { InfoCard } from "./InfoCard";
import { InfoRow } from "./InfoRow";
import { ProgressStepper, type ProgressStepperStep } from "./ProgressStepper";

interface CustomerInfo {
  name: string;
  channel: string;
  membershipTier?: string;
  contact?: string;
  email?: string;
}

interface CustomerPanelProps {
  customer: CustomerInfo | null;
  memo: string;
  onMemoChange: (memo: string) => void;
  onMemoSave?: () => void;
  isMemoSaving?: boolean;
}

const STEPS: ProgressStepperStep[] = [
  { label: "접수", value: "05-03", state: "done" },
  { label: "확인 완료", value: "05-04", state: "done" },
  { label: "처리", value: "진행중", state: "active" },
  { label: "완료", value: "예정", state: "todo" },
];

export function CustomerPanel({
  customer,
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
      <InfoCard title="고객 정보" meta={customer.channel || undefined}>
        <InfoRow label="이름" value={customer.name} />
        <InfoRow label="채널" value={customer.channel} />
        <InfoRow
          label="회원 등급"
          value={customer.membershipTier || "일반"}
          tone={customer.membershipTier ? "signal" : "default"}
        />
        <InfoRow label="연락처" value={customer.contact || "010-****-1234"} />
        <InfoRow label="이메일" value={customer.email || "mi***@example.com"} />
      </InfoCard>

      <InfoCard title="문의 관련 주문" meta="#ORD-2024-08921">
        <InfoRow label="주문일" value="2024-05-03" />
        <InfoRow label="결제금액" value="89,000원" />
        <InfoRow label="상태" tone="signal" value={<Pill tone="signal">배송 완료</Pill>} />
      </InfoCard>

      <InfoCard title="처리 단계" meta="3 of 4">
        <ProgressStepper steps={STEPS} />
      </InfoCard>

      <InfoCard title="확인된 정보" meta="자동 발췌">
        <InfoRow label="카드번호" value="5432 **** **** 8912" />
        <InfoRow label="환불 요청액" value="45,000원" tone="warn" />
        <InfoRow label="환불 사유" value="부분 환불 요청" />
        <InfoRow label="처리 기한" value="2024-05-10" tone="danger" />
      </InfoCard>

      <InfoCard title="상담 메모" meta="private">
        <textarea
          data-testid="customer-memo-textarea"
          value={memo}
          onChange={(e) => onMemoChange(e.target.value)}
          placeholder="상담 메모를 입력하세요..."
          aria-label="상담 메모 입력"
          style={{
            width: "100%",
            minHeight: 84,
            padding: 10,
            fontSize: 12.5,
            lineHeight: 1.5,
            border: "1px solid var(--line)",
            borderRadius: "var(--r-3)",
            background: "var(--paper)",
            color: "var(--ink)",
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />
        <button
          type="button"
          data-testid="customer-memo-save"
          onClick={onMemoSave}
          disabled={isMemoSaveDisabled}
          style={{
            width: "100%",
            marginTop: 10,
            height: 36,
            padding: "0 14px",
            border: isMemoSaveDisabled ? "1px solid var(--line)" : "1px solid var(--ink)",
            borderRadius: "var(--r-3)",
            background: isMemoSaveDisabled ? "var(--paper-2)" : "var(--ink)",
            color: isMemoSaveDisabled ? "var(--ink-4)" : "var(--paper)",
            cursor: isMemoSaveDisabled ? "not-allowed" : "pointer",
            fontSize: 12.5,
            fontWeight: 600,
            letterSpacing: "-0.1px",
          }}
        >
          {isMemoSaving ? "저장 중..." : "메모 저장"}
        </button>
      </InfoCard>
    </div>
  );
}
