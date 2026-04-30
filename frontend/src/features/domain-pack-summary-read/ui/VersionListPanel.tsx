import type { UseQueryResult } from '@tanstack/react-query';
import type { DomainPackDetail, DomainPackVersionSummary } from '@/entities/domain-pack';
import styles from './VersionListPanel.module.css';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
  } catch {
    return iso;
  }
}

interface VersionListPanelProps {
  query: UseQueryResult<DomainPackDetail>;
  selectedId: number | null;
  onSelect: (versionId: number) => void;
  onCreateDraft?: () => void;
}

export function VersionListPanel({ query, selectedId, onSelect, onCreateDraft }: VersionListPanelProps) {
  if (query.isLoading) {
    return (
      <div className={styles.panel}>
        <div className={styles.skeleton}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.skeletonItem} aria-hidden />
          ))}
        </div>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty} role="alert">
          <span>버전 목록을 불러오지 못했습니다.</span>
          <button type="button" className={styles.ctaButton} onClick={() => query.refetch()}>
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  const versions = query.data?.versions ?? [];
  const effectiveSelectedId = selectedId ?? (versions[0]?.versionId ?? null);

  if (versions.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>
          <span>버전이 없습니다.</span>
          {onCreateDraft && (
            <button className={styles.ctaButton} type="button" onClick={onCreateDraft}>
              새 DRAFT 묶기
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>버전 {versions.length}개</div>
      <ul className={styles.list} role="list" aria-label="버전 목록">
        {versions.map((v) => (
          <VersionListItem
            key={v.versionId}
            version={v}
            isActive={v.versionId === selectedId}
            isTabStop={v.versionId === effectiveSelectedId}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </div>
  );
}

interface VersionListItemProps {
  version: DomainPackVersionSummary;
  isActive: boolean;
  isTabStop: boolean;
  onSelect: (versionId: number) => void;
}

function VersionListItem({ version, isActive, isTabStop, onSelect }: VersionListItemProps) {
  return (
    <li className={`${styles.item} ${isActive ? styles.active : ''}`}>
      <button
        type="button"
        className={styles.itemBtn}
        tabIndex={isTabStop ? 0 : -1}
        aria-current={isActive || undefined}
        onClick={() => onSelect(version.versionId)}
      >
        <div className={styles.itemRow}>
          <span className={styles.versionNo}>v{version.versionNo}</span>
          <span
            className={`${styles.badge} ${
              version.lifecycleStatus === 'PUBLISHED' ? styles.badgePublished : styles.badgeDraft
            }`}
          >
            {version.lifecycleStatus}
          </span>
          {version.sourcePipelineJobId !== null && (
            <span className={styles.sourceBadge}>PIPELINE</span>
          )}
        </div>
        <span className={styles.createdAt}>{formatDate(version.createdAt)}</span>
      </button>
    </li>
  );
}
