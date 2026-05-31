import { FileSearch, MessageSquare } from "lucide-react";
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
function Section({
  title,
  emptyText,
  hasItems,
  children,
}: {
  title: string;
  emptyText: string;
  hasItems: boolean;
  children: ReactNode;
}) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      <div className={styles.tagList}>
        {hasItems ? children : <span className={styles.sectionEmpty}>{emptyText}</span>}
      </div>
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
  const slots = domainPackElements?.slots ?? [];
  const policies = domainPackElements?.policies ?? [];
  const risks = domainPackElements?.risks ?? [];
  const hasDomainPackElements = slots.length > 0 || policies.length > 0 || risks.length > 0;
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

      {hasDomainPackElements ? (
        <>
          <Section title="확인 항목" emptyText="확인된 항목 없음" hasItems={slots.length > 0}>
            {slots.map((slot) => (
              <SlotTagItem key={slot.name} slot={slot} />
            ))}
          </Section>

          <Section title="응대 기준" emptyText="적용된 응대 기준 없음" hasItems={policies.length > 0}>
            {policies.map((policy) => (
              <PolicyTagItem key={policy.name} policy={policy} />
            ))}
          </Section>

          <Section title="주의 사항" emptyText="감지된 주의 사항 없음" hasItems={risks.length > 0}>
            {risks.map((risk) => (
              <RiskTagItem key={risk.name} risk={risk} />
            ))}
          </Section>
        </>
      ) : (
        <div className={styles.domainEmpty} data-testid="message-domain-empty">
          <FileSearch size={28} className={styles.domainEmptyIcon} />
          <strong>연결된 도메인 팩 요소가 없습니다</strong>
          <p>확인 항목, 응대 기준, 주의 사항이 연결되면 이 영역에 표시됩니다.</p>
        </div>
      )}

      <div className={styles.closeArea}>
        <button type="button" className={styles.closeButton} onClick={onClose}>
          닫기
        </button>
      </div>
    </aside>
  );
}
