import type { ReactNode } from "react";
import { Eyebrow, Mono, Pill } from "@/shared/ui/ostone/atoms";

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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ padding: "16px", borderBottom: "1px solid var(--line-2)" }}>
      <div style={{ marginBottom: 12 }}>
        <Eyebrow>{title}</Eyebrow>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "4px 0",
      }}
    >
      <Mono style={{ fontSize: 11, color: "var(--ink-3)" }}>{label}</Mono>
      <span style={{ fontSize: 12, color: "var(--ink)" }}>{value}</span>
    </div>
  );
}

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
        style={{
          width: 320,
          flexShrink: 0,
          background: "var(--paper-2)",
          overflow: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Mono style={{ fontSize: 12, color: "var(--ink-3)" }}>
          고객을 선택하면 정보가 표시됩니다
        </Mono>
      </div>
    );
  }

  return (
    <div
      style={{
        width: 320,
        flexShrink: 0,
        background: "var(--paper-2)",
        overflow: "auto",
      }}
    >
      <Section title="고객 정보">
        <Row label="이름" value={customer.name} />
        <Row label="채널" value={customer.channel} />
        <Row label="회원 등급" value={customer.membershipTier || "일반"} />
        <Row label="연락처" value={customer.contact || "010-****-1234"} />
        <Row label="이메일" value={customer.email || "mi***@example.com"} />
      </Section>

      <Section title="문의 관련 주문">
        <Row label="주문 ID" value="#ORD-2024-08921" />
        <Row label="주문일" value="2024-05-03" />
        <Row label="결제금액" value="89,000원" />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "4px 0",
          }}
        >
          <Mono style={{ fontSize: 11, color: "var(--ink-3)" }}>주문 상태</Mono>
          <Pill tone="signal">배송 완료</Pill>
        </div>
      </Section>

      <Section title="처리 단계">
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 0" }}>
          {[
            { label: "접수", done: true },
            { label: "확인 중", done: true },
            { label: "처리 중", done: true, active: true },
            { label: "완료", done: false },
          ].map((step, i, arr) => (
            <div key={step.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: step.active ? 700 : 400,
                  color: step.done ? "var(--signal)" : "var(--ink-4)",
                  fontFamily: "var(--mono)",
                }}
              >
                {step.label}
              </span>
              {i < arr.length - 1 && (
                <span style={{ color: step.done ? "var(--signal)" : "var(--ink-4)", fontSize: 10 }}>
                  →
                </span>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="확인된 정보">
        {[
          { field: "카드번호", value: "5432 **** **** 8912" },
          { field: "환불 요청액", value: "45,000원" },
          { field: "환불 사유", value: "부분 환불 요청" },
          { field: "처리 기한", value: "2024-05-10" },
        ].map((item) => (
          <div key={item.field} style={{ padding: "4px 0" }}>
            <Mono
              style={{ fontSize: 10, color: "var(--ink-3)", display: "block", marginBottom: 2 }}
            >
              {item.field}
            </Mono>
            <span style={{ fontSize: 12, color: "var(--ink)" }}>{item.value}</span>
          </div>
        ))}
      </Section>

      <Section title="상담 메모">
        <textarea
          value={memo}
          onChange={(e) => onMemoChange(e.target.value)}
          placeholder="상담 메모를 입력하세요..."
          style={{
            width: "100%",
            minHeight: 80,
            padding: 8,
            fontSize: 12,
            lineHeight: 1.5,
            border: "1px solid var(--line)",
            borderRadius: "var(--r-2)",
            background: "var(--paper)",
            color: "var(--ink)",
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />
        <button
          type="button"
          onClick={onMemoSave}
          disabled={isMemoSaveDisabled}
          style={{
            width: "100%",
            marginTop: 8,
            padding: "8px 10px",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-2)",
            background: isMemoSaveDisabled ? "var(--paper-2)" : "var(--ink)",
            color: isMemoSaveDisabled ? "var(--ink-4)" : "var(--paper)",
            cursor: isMemoSaveDisabled ? "not-allowed" : "pointer",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {isMemoSaving ? "저장 중..." : "메모 저장"}
        </button>
      </Section>
    </div>
  );
}
