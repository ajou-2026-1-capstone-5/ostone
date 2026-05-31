import type { IntentRevisionChange } from "../model/useIntentRevisionSummary";
import styles from "./intent-revision-draft.module.css";

interface IntentRevisionDiffPanelProps {
  change?: IntentRevisionChange;
}

export function IntentRevisionDiffPanel({ change }: IntentRevisionDiffPanelProps) {
  if (!change) return null;

  return (
    <section className={styles.diffPanel} aria-label="상담 유형 수정 내용">
      <header className={styles.sectionHeader}>
        <span>상담 유형 수정 내용</span>
        <span>{change.fields.length}개 항목</span>
      </header>
      <div className={styles.diffGrid}>
        {change.fields.includes("name") && (
          <DiffRow label="이름" before={change.before.name} after={change.after.name} />
        )}
        {change.fields.includes("description") && (
          <DiffRow
            label="설명"
            before={change.before.description}
            after={change.after.description}
          />
        )}
      </div>
    </section>
  );
}

function DiffRow({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className={styles.diffRow}>
      <span className={styles.diffLabel}>{label}</span>
      <div className={styles.diffValues}>
        <div>
          <span className={styles.diffCaption}>변경 전</span>
          <p>{before || "비어 있음"}</p>
        </div>
        <div>
          <span className={styles.diffCaption}>변경 후</span>
          <p>{after || "비어 있음"}</p>
        </div>
      </div>
    </div>
  );
}
