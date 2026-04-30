import { useState, useMemo, Fragment } from 'react';
import { parseSummaryJson } from '../model/parseSummaryJson';
import styles from './SummaryJsonCard.module.css';

interface SummaryJsonCardProps {
  summaryJson: string;
}

export function SummaryJsonCard({ summaryJson }: SummaryJsonCardProps) {
  const [mode, setMode] = useState<'card' | 'raw'>('card');

  const parsed = useMemo(() => parseSummaryJson(summaryJson), [summaryJson]);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>Summary JSON</span>
        <div className={styles.toggleGroup} role="group" aria-label="보기 방식">
          <button
            type="button"
            className={`${styles.toggleBtn} ${mode === 'card' ? styles.active : ''}`}
            onClick={() => setMode('card')}
            aria-pressed={mode === 'card'}
          >
            카드
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${mode === 'raw' ? styles.active : ''}`}
            onClick={() => setMode('raw')}
            aria-pressed={mode === 'raw'}
          >
            Raw JSON
          </button>
        </div>
      </div>
      <div className={styles.cardBody}>
        {mode === 'card' ? (
          <>
            {!parsed.ok && (
              <p className={styles.fallbackWarning} role="alert">
                JSON 파싱 실패 — 원문 표시
              </p>
            )}
            {parsed.ok ? (
              Object.keys(parsed.data).length === 0 ? (
                <span className={styles.empty}>내용 없음</span>
              ) : (
                <div className={styles.keyValueGrid}>
                  {Object.entries(parsed.data).map(([k, v]) => (
                    <Fragment key={k}>
                      <span className={styles.key}>{k}</span>
                      <span className={styles.value}>{String(v)}</span>
                    </Fragment>
                  ))}
                </div>
              )
            ) : (
              <pre className={styles.rawPre}><code>{parsed.raw}</code></pre>
            )}
          </>
        ) : (
          <pre className={styles.rawPre}><code>{summaryJson}</code></pre>
        )}
      </div>
    </div>
  );
}
