import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiRequestError } from '@/shared/api';
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout';
import { parseRouteId } from '@/shared/lib/parseRouteId';
import { usePackDetail, useVersionDetail, VersionListPanel, SummaryDetailPanel } from '@/features/domain-pack-summary-read';
import { CreateDraftModal } from '@/features/domain-pack-draft-create';
import styles from './domain-pack-summary-page.module.css';

export function DomainPackSummaryPage() {
  const { workspaceId, packId } = useParams();
  const [search, setSearch] = useSearchParams();
  const [isCreateOpen, setCreateOpen] = useState(false);

  const wsId = parseRouteId(workspaceId);
  const pId = parseRouteId(packId);

  if (wsId === null || pId === null) {
    return (
      <DashboardLayout>
        <div className={styles.invalidParams} role="alert">
          잘못된 URL 파라미터입니다.
        </div>
      </DashboardLayout>
    );
  }

  return <DomainPackSummaryPageContent wsId={wsId} packId={pId} search={search} setSearch={setSearch} isCreateOpen={isCreateOpen} setCreateOpen={setCreateOpen} />;
}

interface ContentProps {
  wsId: number;
  packId: number;
  search: URLSearchParams;
  setSearch: (updater: ((prev: URLSearchParams) => URLSearchParams) | URLSearchParams, options?: { replace?: boolean }) => void;
  isCreateOpen: boolean;
  setCreateOpen: (open: boolean) => void;
}

function DomainPackSummaryPageContent({ wsId, packId, search, setSearch, isCreateOpen, setCreateOpen }: ContentProps) {
  const packQuery = usePackDetail(wsId, packId);

  useEffect(() => {
    if (!packQuery.isError) return;
    const is404 = packQuery.error instanceof ApiRequestError && packQuery.error.status === 404;
    toast.error(is404 ? 'Pack을 찾을 수 없습니다.' : 'Pack 정보를 불러오지 못했습니다.');
  }, [packQuery.isError, packQuery.error]);

  const rawVersionId = search.get('versionId');
  const selectedVersionId = rawVersionId !== null ? parseRouteId(rawVersionId) : null;

  useEffect(() => {
    if (!packQuery.data) return;
    if (selectedVersionId !== null) return;
    if (packQuery.data.versions.length === 0) return;
    const latest = packQuery.data.versions.reduce((a, b) =>
      a.versionNo >= b.versionNo ? a : b,
    );
    setSearch(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('versionId', String(latest.versionId));
        return next;
      },
      { replace: true },
    );
  }, [packQuery.data, search, setSearch]);

  const versionQuery = useVersionDetail(wsId, packId, selectedVersionId);

  const handleSelectVersion = (versionId: number) => {
    setSearch((prev) => {
      const next = new URLSearchParams(prev);
      next.set('versionId', String(versionId));
      return next;
    });
  };

  const handleCreateSuccess = (newVersionId: number) => {
    setCreateOpen(false);
    setSearch((prev) => {
      const next = new URLSearchParams(prev);
      next.set('versionId', String(newVersionId));
      return next;
    });
  };

  const pack = packQuery.data;

  if (packQuery.isError) {
    const is404 = packQuery.error instanceof ApiRequestError && packQuery.error.status === 404;
    return (
      <DashboardLayout>
        <div className={styles.errorCard} role="alert">
          <span>{is404 ? 'Pack을 찾을 수 없습니다.' : 'Pack 정보를 불러오지 못했습니다.'}</span>
          {!is404 && (
            <button type="button" className={styles.retryBtn} onClick={() => packQuery.refetch()}>
              다시 시도
            </button>
          )}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <nav className={styles.breadcrumb} aria-label="경로">
              <span>WS · {wsId}</span>
              <span className={styles.breadcrumbSep}>/</span>
              <span>PACK · {packId}</span>
            </nav>
            {pack && (
              <div className={styles.packMeta}>
                <span className={styles.packName}>{pack.name}</span>
                <span className={styles.packCode}>{pack.code}</span>
              </div>
            )}
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.createBtn}
              onClick={() => setCreateOpen(true)}
            >
              새 DRAFT 묶기
            </button>
          </div>
        </header>

        <div className={styles.twoPane}>
          <VersionListPanel
            query={packQuery}
            selectedId={selectedVersionId}
            onSelect={handleSelectVersion}
            onCreateDraft={() => setCreateOpen(true)}
          />
          <SummaryDetailPanel
            query={versionQuery}
            wsId={wsId}
            packId={packId}
          />
        </div>
      </div>

      {isCreateOpen && (
        <CreateDraftModal
          wsId={wsId}
          packId={packId}
          onClose={() => setCreateOpen(false)}
          onSuccess={handleCreateSuccess}
        />
      )}
    </DashboardLayout>
  );
}
