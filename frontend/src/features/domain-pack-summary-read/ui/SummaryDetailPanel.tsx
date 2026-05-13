import type { UseQueryResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { DomainPackVersionDetail, DomainPackVersionSummary } from '@/entities/domain-pack';
import { ApiRequestError } from '@/shared/api';
import { useActivate } from '@/shared/api/generated/endpoints/activate-domain-pack-version-controller/activate-domain-pack-version-controller';
import { ErrorState } from '@/shared/ui/ostone/atoms/ErrorState';
import { useDomainPackApprovalReadiness } from '../model/useDomainPackApprovalReadiness';
import { resolveDomainPackApprovalErrorMessage } from '../model/resolveDomainPackApprovalErrorMessage';
import { SummaryJsonCard } from './SummaryJsonCard';
import { ComponentCountGrid } from './ComponentCountGrid';
import { DomainPackApprovalCard } from './DomainPackApprovalCard';
import styles from './SummaryDetailPanel.module.css';

interface SummaryDetailPanelProps {
  query: UseQueryResult<DomainPackVersionDetail>;
  wsId: number;
  packId: number;
  versions: DomainPackVersionSummary[];
  onActivated: () => void | Promise<unknown>;
  renderSlotEditSheet?: (slotId: number, isOpen: boolean, onClose: () => void) => React.ReactNode;
}

export function SummaryDetailPanel({
  query,
  wsId,
  packId,
  versions,
  onActivated,
  renderSlotEditSheet,
}: Readonly<SummaryDetailPanelProps>) {
  const activateMutation = useActivate();
  const v = query.data;
  const readiness = useDomainPackApprovalReadiness({
    workspaceId: wsId,
    packId,
    version: v,
    versions,
  });
  const versionId = v?.versionId;

  const handleApprove = async () => {
    if (versionId == null) {
      toast.error('승인 준비 상태를 확인하는 데 필요한 정보가 부족합니다.');
      return;
    }

    if (readiness.isLoading) {
      toast.error('승인 준비 상태를 확인하는 중입니다.');
      return;
    }

    if (!readiness.ready) {
      toast.error(readiness.blockers[0]?.message ?? '승인 조건을 먼저 처리해 주세요.');
      return;
    }

    try {
      await activateMutation.mutateAsync({ workspaceId: wsId, packId, versionId });
    } catch (error) {
      toast.error(resolveDomainPackApprovalErrorMessage(error));
      return;
    }

    toast.success('Domain Pack 버전이 승인되었습니다.');

    try {
      await query.refetch();
      await onActivated();
      readiness.retry();
    } catch (error) {
      console.error('Failed to sync domain pack approval state', error);
      toast.error('승인 후 화면 정보를 갱신하지 못했습니다.');
    }
  };

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
        <ErrorState
          message={is404 ? '버전을 찾을 수 없습니다.' : '버전 정보를 불러오지 못했습니다.'}
          onRetry={!is404 ? () => query.refetch() : undefined}
        />
      </div>
    );
  }

  if (!v) return null;

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
          <span className={styles.metaValue}>{formatDate(v.createdAt ?? "")}</span>
          {v.sourcePipelineJobId != null && (
            <>
              <span className={styles.metaKey}>Pipeline Job</span>
              <span className={styles.metaValue}>{v.sourcePipelineJobId}</span>
            </>
          )}
        </div>
      </div>

      <DomainPackApprovalCard
        readiness={readiness}
        isActivating={activateMutation.isPending}
        isPublished={v.lifecycleStatus === 'PUBLISHED'}
        onApprove={handleApprove}
        onRetryReadiness={readiness.retry}
      />

      <div>
        <div className={styles.sectionTitle}>Summary JSON</div>
        <SummaryJsonCard summaryJson={v.summaryJson ?? ""} />
      </div>

      <div>
        <div className={styles.sectionTitle}>구성요소</div>
        {versionId != null && (
          <ComponentCountGrid
            wsId={wsId}
            packId={packId}
            versionId={versionId}
            intentCount={v.intentCount ?? 0}
            slotCount={v.slotCount ?? 0}
            policyCount={v.policyCount ?? 0}
            riskCount={v.riskCount ?? 0}
            workflowCount={v.workflowCount ?? 0}
            renderSlotEditSheet={renderSlotEditSheet}
          />
        )}
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
