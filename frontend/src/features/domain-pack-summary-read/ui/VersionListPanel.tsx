import type { UseQueryResult } from "@tanstack/react-query";
import type { DomainPackDetail, DomainPackVersionSummary } from "@/entities/domain-pack";
import { formatLifecycleStatus } from "../model/versionFormat";
import styles from "./VersionListPanel.module.css";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

interface VersionListPanelProps {
  query: UseQueryResult<DomainPackDetail>;
  selectedId: number | null;
  currentVersionId?: number | null;
  onSelect: (versionId: number) => void;
}

export function VersionListPanel({
  query,
  selectedId,
  currentVersionId = null,
  onSelect,
}: VersionListPanelProps) {
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
  const effectiveSelectedId = selectedId ?? versions[0]?.versionId ?? null;

  if (versions.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>
          <span>버전이 없습니다.</span>
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
            isCurrentVersion={v.versionId != null && v.versionId === currentVersionId}
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
  isCurrentVersion: boolean;
  isTabStop: boolean;
  onSelect: (versionId: number) => void;
}

function VersionListItem({
  version,
  isActive,
  isCurrentVersion,
  isTabStop,
  onSelect,
}: VersionListItemProps) {
  const versionId = version.versionId;
  const versionNo = version.versionNo ?? "-";
  const isPublished = version.lifecycleStatus === "PUBLISHED";

  return (
    <li className={`${styles.item} ${isActive ? styles.active : ""}`}>
      <button
        type="button"
        className={styles.itemBtn}
        tabIndex={isTabStop ? 0 : -1}
        aria-current={isActive || undefined}
        onClick={() => versionId !== undefined && onSelect(versionId)}
      >
        <div className={styles.itemRow}>
          <span className={styles.versionNo}>v{versionNo}</span>
          {!isPublished && (
            <span className={`${styles.badge} ${styles.badgeDraft}`}>
              {formatLifecycleStatus(version.lifecycleStatus)}
            </span>
          )}
          {isCurrentVersion && (
            <span className={`${styles.badge} ${styles.badgeOperating}`}>배포중</span>
          )}
        </div>
        <span className={styles.createdAt}>{formatDate(version.createdAt ?? "")}</span>
        {version.description ? (
          <span className={styles.description}>{version.description}</span>
        ) : null}
      </button>
    </li>
  );
}
