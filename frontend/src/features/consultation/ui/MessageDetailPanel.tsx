import { MessageSquare } from "lucide-react";
import type { ReactNode } from "react";
import { getChatRolePresentation } from "../lib/chatRoleLabels";
import styles from "./MessageDetailPanel.module.css";

/* ─── Types ─── */
export interface SlotTag {
  name: string;
  extracted: boolean;
  value?: string;
}

export interface PolicyTag {
  name: string;
  extracted: boolean;
  matched: boolean;
}

export interface RiskTag {
  name: string;
  extracted: boolean;
  level: "low" | "medium" | "high";
}

export interface MessageDetailPanelProps {
  message: {
    id: string;
    senderRole: string;
    content: string;
    timestamp: string;
  } | null;
  domainPackElements?: {
    slots: SlotTag[];
    policies: PolicyTag[];
    risks: RiskTag[];
  };
  onClose: () => void;
}

/* ─── Mock Data ─── */
const MOCK_DATA: {
  slots: SlotTag[];
  policies: PolicyTag[];
  risks: RiskTag[];
} = {
  slots: [
    { name: "가격 문의", extracted: true, value: "89,000원" },
    { name: "주문 번호", extracted: true, value: "#ORD-2024-08921" },
    { name: "배송지 주소", extracted: false },
  ],
  policies: [
    { name: "반품 응대 기준", extracted: true, matched: true },
    { name: "환불 응대 기준", extracted: true, matched: false },
    { name: "교환 응대 기준", extracted: false, matched: false },
  ],
  risks: [
    { name: "고객 불만 고조", extracted: true, level: "high" as const },
    { name: "환불 요청", extracted: true, level: "medium" as const },
    { name: "법적 대응", extracted: false, level: "low" as const },
  ],
} as const;

/* ─── Helpers ─── */
function riskTagClass(risk: RiskTag): string {
  if (!risk.extracted) return `${styles.tag} ${styles.tagNotExtracted}`;
  const levelClass =
    risk.level === "high"
      ? styles.tagRiskHigh
      : risk.level === "medium"
        ? styles.tagRiskMedium
        : styles.tagRiskLow;
  return `${styles.tag} ${levelClass}`;
}

/* ─── Sub-components ─── */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      <div className={styles.tagList}>{children}</div>
    </div>
  );
}

function SlotTagItem({ slot }: { slot: SlotTag }) {
  const cls = slot.extracted
    ? `${styles.tag} ${styles.tagExtracted}`
    : `${styles.tag} ${styles.tagNotExtracted}`;
  return (
    <span className={cls}>
      {slot.name}
      {slot.value && <span className={styles.tagValue}>{slot.value}</span>}
    </span>
  );
}

function PolicyTagItem({ policy }: { policy: PolicyTag }) {
  const cls =
    policy.extracted && policy.matched
      ? `${styles.tag} ${styles.tagExtracted}`
      : `${styles.tag} ${styles.tagNotExtracted}`;
  return <span className={cls}>{policy.name}</span>;
}

function RiskTagItem({ risk }: { risk: RiskTag }) {
  const cls = riskTagClass(risk);
  return <span className={cls}>{risk.name}</span>;
}

/* ─── Component ─── */
export function MessageDetailPanel({
  message,
  domainPackElements,
  onClose,
}: MessageDetailPanelProps) {
  const { slots, policies, risks } = domainPackElements ?? MOCK_DATA;
  const roleLabel = message ? getChatRolePresentation(message.senderRole).label : "";

  if (!message) {
    return (
      <aside className={styles.wrapper}>
        <div className={styles.emptyState}>
          <MessageSquare size={36} className={styles.emptyStateIcon} />
          <p className={styles.emptyStateText}>메시지를 선택하세요</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.wrapper}>
      <div className={styles.messageHeader}>
        <div className={styles.messageMeta}>
          <span className={styles.senderRole}>{roleLabel}</span>
          <span className={styles.timestamp}>{message.timestamp}</span>
        </div>
        <p className={styles.messagePreview}>{message.content}</p>
      </div>

      <Section title="확인 항목">
        {slots.map((slot) => (
          <SlotTagItem key={slot.name} slot={slot} />
        ))}
      </Section>

      <Section title="응대 기준">
        {policies.map((policy) => (
          <PolicyTagItem key={policy.name} policy={policy} />
        ))}
      </Section>

      <Section title="주의 사항">
        {risks.map((risk) => (
          <RiskTagItem key={risk.name} risk={risk} />
        ))}
      </Section>

      <div className={styles.closeArea}>
        <button type="button" className={styles.closeButton} onClick={onClose}>
          닫기
        </button>
      </div>
    </aside>
  );
}
