import type { DemoExecution, DemoPolicyHit, DemoRiskHit } from '../model/chatWorkflow.types';
import styles from './chat-workflow-demo.module.css';

interface ExecutionDetailPanelProps {
  execution: DemoExecution | null;
}

function PolicyHitRow({ hit }: { hit: DemoPolicyHit }) {
  const isPass = hit.result === 'PASS';
  return (
    <div className={styles.hitRow}>
      <span className={styles.hitMark}>{isPass ? 'OK' : 'NO'}</span>
      <div>
        <div className={styles.hitTitle}>
          <span>{hit.policyName}</span>
          <span className={styles.hitResult}>({hit.result})</span>
        </div>
        <p className={styles.hitDetail}>{hit.detail}</p>
      </div>
    </div>
  );
}

function RiskHitRow({ hit }: { hit: DemoRiskHit }) {
  const isLow = hit.result === 'LOW';
  return (
    <div className={styles.hitRow}>
      <span className={styles.hitMark}>{isLow ? 'LOW' : '!'}</span>
      <div>
        <div className={styles.hitTitle}>
          <span>{hit.riskName}</span>
          <span className={styles.hitResult}>({hit.result})</span>
        </div>
        <p className={styles.hitDetail}>{hit.detail}</p>
      </div>
    </div>
  );
}

export function ExecutionDetailPanel({ execution }: ExecutionDetailPanelProps) {
  if (!execution) {
    return (
      <div className={styles.detailPanel}>
        <h3>Execution Detail</h3>
        <p className={styles.empty}>Waiting for execution...</p>
      </div>
    );
  }

  const normalizedStatus = execution.status.toLowerCase();

  return (
    <div className={styles.detailPanel}>
      <h3>Execution Detail</h3>
      <div className={styles.detailStack}>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <span className={styles.labelText}>Status</span>
            <span className={styles.statusValue} data-status={normalizedStatus} data-testid="execution-status">
              {execution.status}
            </span>
          </div>

          <div className={styles.summaryItem} data-testid="execution-intent">
            <span className={styles.labelText}>Intent</span>
            <p className={styles.intentValue}>{execution.intent}</p>
          </div>
        </div>

        <div className={styles.slots} data-testid="execution-slots">
          <span className={styles.labelText}>Slot Values:</span>
          <div className={styles.slotGrid}>
            {Object.entries(execution.slotValues).map(([key, value]) => (
              <div key={key} className={styles.slotItem}>
                <span className={styles.slotKey}>{key}</span>
                <span className={styles.slotValue}>{String(value)}</span>
              </div>
            ))}
          </div>
        </div>

        {execution.missingSlots.length > 0 && (
          <div className={styles.missing}>
            <span className={styles.labelText}>Missing Slots:</span>
            <div className={styles.chipList}>
              {execution.missingSlots.map((slot) => (
                <span key={slot} className={styles.chip}>
                  {slot}
                </span>
              ))}
            </div>
          </div>
        )}

        {execution.policyHits.length > 0 && (
          <div data-testid="execution-policies">
            <span className={styles.hitGroupLabel}>Policy Hits:</span>
            <div className={styles.hitList}>
              {execution.policyHits.map((hit) => (
                <PolicyHitRow key={hit.policyId} hit={hit} />
              ))}
            </div>
          </div>
        )}

        {execution.riskHits.length > 0 && (
          <div data-testid="execution-risks">
            <span className={styles.hitGroupLabel}>Risk Hits:</span>
            <div className={styles.hitList}>
              {execution.riskHits.map((hit) => (
                <RiskHitRow key={hit.riskId} hit={hit} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
