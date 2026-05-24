import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import type { UseQueryResult } from "@tanstack/react-query";
import { ApiRequestError } from "@/shared/api";
import { useDeploy } from "@/shared/api/generated/endpoints/deploy-domain-pack-version-controller/deploy-domain-pack-version-controller";
import { OstoneShell } from "@/widgets/ostone-shell";
import { LoadingSpinner } from "@/shared/ui/ostone/atoms/LoadingSpinner";
import { ErrorState } from "@/shared/ui/ostone/atoms/ErrorState";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import {
  usePackDetail,
  useVersionDetail,
  VersionListPanel,
  SummaryDetailPanel,
} from "@/features/domain-pack-summary-read";
import type { DomainPackDetail, DomainPackVersionDetail } from "@/entities/domain-pack";
import styles from "./domain-pack-summary-page.module.css";

export function DomainPackSummaryPage() {
  const { workspaceId, packId } = useParams();
  const [search, setSearch] = useSearchParams();

  const wsId = parseRouteId(workspaceId);
  const pId = parseRouteId(packId);
  const rawVersionId = search.get("versionId");
  const vId = rawVersionId === null ? null : parseRouteId(rawVersionId);

  if (wsId === null || pId === null || (rawVersionId !== null && vId === null)) {
    return (
      <OstoneShell active="domain" crumbs={[]}>
        <div className={styles.invalidParams} role="alert">
          잘못된 URL 파라미터입니다.
        </div>
      </OstoneShell>
    );
  }

  return (
    <DomainPackSummaryPageContent
      wsId={wsId}
      packId={pId}
      selectedVersionId={vId}
      setSearch={setSearch}
    />
  );
}

interface ContentProps {
  wsId: number;
  packId: number;
  selectedVersionId: number | null;
  setSearch: ReturnType<typeof useSearchParams>[1];
}

function DomainPackSummaryPageContent({
  wsId,
  packId,
  selectedVersionId,
  setSearch,
}: ContentProps) {
  const packQuery = usePackDetail(wsId, packId) as UseQueryResult<DomainPackDetail>;

  useEffect(() => {
    if (!packQuery.isError) return;
    const is404 = packQuery.error instanceof ApiRequestError && packQuery.error.status === 404;
    toast.error(is404 ? "Pack을 찾을 수 없습니다." : "Pack 정보를 불러오지 못했습니다.");
  }, [packQuery.isError, packQuery.error]);

  const versionQuery = useVersionDetail(
    wsId,
    packId,
    selectedVersionId,
  ) as UseQueryResult<DomainPackVersionDetail>;
  const deployMutation = useDeploy({
    mutation: {
      onSuccess: async () => {
        await Promise.all([packQuery.refetch(), versionQuery.refetch()]);
        toast.success("도메인팩 버전이 배포되었습니다.");
      },
      onError: (error) => {
        toast.error(resolveDeployErrorMessage(error));
      },
    },
  });

  const handleSelectVersion = (versionId: number) => {
    setSearch(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("versionId", String(versionId));
        return next;
      },
      { replace: true },
    );
  };

  const handleDeployVersion = (versionId: number) => {
    deployMutation.mutate({ workspaceId: wsId, packId, versionId });
  };

  const pack = packQuery.data;
  const currentVersionId = pack?.currentVersionId ?? null;

  if (packQuery.isLoading) {
    return (
      <OstoneShell active="domain" crumbs={[`PACK \u00b7 ${packId}`]}>
        <LoadingSpinner />
      </OstoneShell>
    );
  }

  if (packQuery.isError) {
    const is404 = packQuery.error instanceof ApiRequestError && packQuery.error.status === 404;
    return (
      <OstoneShell active="domain" crumbs={[`PACK \u00b7 ${packId}`]}>
        <ErrorState
          message={is404 ? "Pack을 찾을 수 없습니다." : "Pack 정보를 불러오지 못했습니다."}
          onRetry={!is404 ? () => packQuery.refetch() : undefined}
        />
      </OstoneShell>
    );
  }

  return (
    <OstoneShell active="domain" crumbs={[pack?.name || `PACK \u00b7 ${packId}`]}>
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
        </header>

        <div className={styles.twoPane}>
          <VersionListPanel
            query={packQuery}
            selectedId={selectedVersionId}
            currentVersionId={currentVersionId}
            onSelect={handleSelectVersion}
          />
          <SummaryDetailPanel
            query={versionQuery}
            wsId={wsId}
            packId={packId}
            currentVersionId={currentVersionId}
            deployingVersionId={
              deployMutation.isPending ? deployMutation.variables?.versionId : null
            }
            onDeploy={handleDeployVersion}
          />
        </div>
      </div>
    </OstoneShell>
  );
}

function resolveDeployErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError && error.message) {
    return error.message;
  }
  return "도메인팩 버전을 배포하지 못했습니다.";
}
