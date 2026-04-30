import type { UseQueryResult } from '@tanstack/react-query';
import type { DomainPackVersionDetail } from '@/entities/domain-pack';
import { ApiRequestError } from '@/shared/api';
import { SummaryJsonCard } from './SummaryJsonCard';
import { ComponentCountGrid } from './ComponentCountGrid';
import styles from './SummaryDetailPanel.module.css';

interface SummaryDetailPanelProps {
  query: UseQueryResult<DomainPackVersionDetail>;
  wsId: number;
  packId: number;
}

export function SummaryDetailPanel({ query, wsId, packId }: SummaryDetailPanelProps) {
  if (!query.isFetching && !query.data && !query.isLoading && !query.isError) {
    return (
      <div className={styles.panel}>
        <div className={styles.placeholder}>버전을 선택하세요.</div>
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className={styles.panel}>
        <div className={styles.skeleton} aria-label="로딩 중">
          <div className={styles.skeletonBlock} style={{ height: 80 }} aria-hidden />
          <div className={styles.skeletonBlock} style={{ height: 160 }} aria-hidden />
          <div className={styles.skeletonBlock} style={{ height: 200 }} aria-hidden />
        </div>
      </div>
    );
  }

  if (query.isError) {
    const is404 = query.error instanceof ApiRequestError && query.error.status === 404;
    return (
      <div className={styles.panel}>
        <div className={styles.error} role="alert">
          <span>{is404 ? '버전을 찾을 수 없습니다.' : '버전 상세 정보를 불러오지 못했습니다.'}</span>
          {!is404 && (
            <button type="button" className={styles.errorRetryBtn} onClick={() => query.refetch()}>
              다시 시도
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!query.data) return null;
  const v = query.data;

  return (
    <div className={styles.panel}>
      <div className={styles.metaCard}>
        <div className={styles.metaHeader}>
          <span className={styles.versionNoLabel}>v{v.versionNo}</span>
          <span
            className={`${styles.badge} ${
              v.lifecycleStatus === 'PUBLISHED' ? styles.badgePublished : ''
            }`}
          >
            {v.lifecycleStatus}
          </span>
        </div>
        <div className={styles.metaGrid}>
          <span className={styles.metaKey}>생성</span>
          <span className={styles.metaValue}>{formatDate(v.createdAt)}</span>
          {v.sourcePipelineJobId !== null && (
            <>
              <span className={styles.metaKey}>Pipeline Job</span>
              <span className={styles.metaValue}>{v.sourcePipelineJobId}</span>
            </>
          )}
        </div>
      </div>

      <div>
        <div className={styles.sectionTitle}>Summary JSON</div>
        <SummaryJsonCard summaryJson={v.summaryJson} />
      </div>

      <div>
        <div className={styles.sectionTitle}>구성요소</div>
        <ComponentCountGrid
          wsId={wsId}
          packId={packId}
          versionId={v.versionId}
          intentCount={v.intentCount}
          slotCount={v.slotCount}
          policyCount={v.policyCount}
          riskCount={v.riskCount}
          workflowCount={v.workflowCount}
        />
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR');
  } catch {
    return iso;
  }
}
