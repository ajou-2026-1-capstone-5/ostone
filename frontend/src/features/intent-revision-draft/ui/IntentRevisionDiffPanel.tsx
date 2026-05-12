import type { IntentRevisionChange } from "../model/useIntentRevisionSummary";
import styles from "./intent-revision-draft.module.css";

interface IntentRevisionDiffPanelProps {
  change?: IntentRevisionChange;
}

export function IntentRevisionDiffPanel({ change }: IntentRevisionDiffPanelProps) {
  if (!change) return null;

  return (
    <section className={styles.diffPanel} aria-label="Intent 수정 diff">
      <header className={styles.sectionHeader}>
        <span>Intent 수정 diff</span>
        <span>{change.fields.length} fields</span>
      </header>
      <div className={styles.diffGrid}>
        {change.fields.includes("name") && (
          <DiffRow label="Name" before={change.before.name} after={change.after.name} />
        )}
        {change.fields.includes("description") && (
          <DiffRow
            label="Description"
            before={change.before.description}
            after={change.after.description}
          />
        )}
      </div>
    </section>
  );
}

function DiffRow({
  label,
  before,
  after,
}: {
  label: string;
  before: string;
  after: string;
}) {
  return (
    <div className={styles.diffRow}>
      <span className={styles.diffLabel}>{label}</span>
      <div className={styles.diffValues}>
        <div>
          <span className={styles.diffCaption}>Before</span>
          <p>{before || "비어 있음"}</p>
        </div>
        <div>
          <span className={styles.diffCaption}>After</span>
          <p>{after || "비어 있음"}</p>
        </div>
      </div>
    </div>
  );
}
