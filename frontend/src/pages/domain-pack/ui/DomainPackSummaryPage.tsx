import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import type { UseQueryResult } from "@tanstack/react-query";
import { ApiRequestError } from "@/shared/api";
import { useDeploy } from "@/shared/api/generated/endpoints/deploy-domain-pack-version-controller/deploy-domain-pack-version-controller";
import { useActivate } from "@/shared/api/generated/endpoints/activate-domain-pack-version-controller/activate-domain-pack-version-controller";
import { useDiscard } from "@/shared/api/generated/endpoints/discard-draft-version-controller/discard-draft-version-controller";
import { OstoneShell } from "@/widgets/ostone-shell";
import { LoadingSpinner } from "@/shared/ui/ostone/atoms/LoadingSpinner";
import { ErrorState } from "@/shared/ui/ostone/atoms/ErrorState";
import type { Crumb } from "@/shared/ui/ostone/chrome";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { domainPackPath, withVersionSearch } from "@/shared/lib/domainPackRoutes";
import {
  usePackDetail,
  useVersionDetail,
  VersionListPanel,
  SummaryDetailPanel,
} from "@/features/domain-pack-summary-read";
import type {
  DomainPackDetail,
  DomainPackVersionDetail,
  DomainPackVersionSummary,
} from "@/entities/domain-pack";
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
  const pack = packQuery.data;
  const defaultVersionId = resolveDefaultVersionId(pack);
  const effectiveSelectedVersionId = selectedVersionId ?? defaultVersionId;

  useEffect(() => {
    if (!packQuery.isError) return;
    const is404 = packQuery.error instanceof ApiRequestError && packQuery.error.status === 404;
    toast.error(is404 ? "Pack을 찾을 수 없습니다." : "Pack 정보를 불러오지 못했습니다.");
  }, [packQuery.isError, packQuery.error]);

  useEffect(() => {
    if (selectedVersionId !== null || defaultVersionId === null) return;
    setSearch(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("versionId", String(defaultVersionId));
        return next;
      },
      { replace: true },
    );
  }, [defaultVersionId, selectedVersionId, setSearch]);

  const versionQuery = useVersionDetail(
    wsId,
    packId,
    effectiveSelectedVersionId,
  ) as UseQueryResult<DomainPackVersionDetail>;
  const currentVersionId = pack?.currentVersionId ?? null;
  const selectedVersionNo =
    pack?.versions?.find((v) => v.versionId === effectiveSelectedVersionId)?.versionNo ?? null;

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
  const activateMutation = useActivate({
    mutation: {
      onSuccess: async (result, variables) => {
        const activatedVersionId = resolveActivatedVersionId(result, variables.versionId);
        setSearch(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.set("versionId", String(activatedVersionId));
            return next;
          },
          { replace: true },
        );
        await Promise.allSettled([packQuery.refetch(), versionQuery.refetch()]);
        toast.success("검토 중인 버전이 운영 버전으로 적용되었습니다.");
      },
      onError: (error) => {
        toast.error(resolveVersionActionErrorMessage(error, "검토 중인 버전을 적용하지 못했습니다."));
      },
    },
  });
  const discardMutation = useDiscard({
    mutation: {
      onSuccess: async () => {
        const refetched = await packQuery.refetch();
        const targetVersionId = refetched.data?.currentVersionId ?? currentVersionId;
        setSearch(
          (prev) => {
            const next = new URLSearchParams(prev);
            if (targetVersionId != null) {
              next.set("versionId", String(targetVersionId));
            } else {
              next.delete("versionId");
            }
            return next;
          },
          { replace: true },
        );
        toast.success("검토 중인 버전이 삭제되었습니다.");
      },
      onError: (error) => {
        toast.error(resolveVersionActionErrorMessage(error, "검토 중인 버전을 삭제하지 못했습니다."));
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

  const handleApplyDraft = (versionId: number) => {
    activateMutation.mutate({ workspaceId: wsId, packId, versionId });
  };

  const handleDiscardDraft = (versionId: number) => {
    discardMutation.mutate({
      workspaceId: wsId,
      packId,
      draftVersionId: versionId,
    });
  };

  const buildSummaryCrumbs = (): Crumb[] => {
    const items: Crumb[] = [
      { label: "도메인팩", href: `/workspaces/${wsId}/domain-packs` },
      {
        label: pack?.name ?? `PACK · ${packId}`,
        href: domainPackPath(wsId, packId),
      },
    ];
    if (effectiveSelectedVersionId !== null && selectedVersionNo !== null) {
      items.push({
        label: `#${selectedVersionNo}`,
        href: withVersionSearch(domainPackPath(wsId, packId), effectiveSelectedVersionId),
      });
    }
    return items;
  };

  if (packQuery.isLoading) {
    return (
      <OstoneShell active="domain" crumbs={buildSummaryCrumbs()}>
        <LoadingSpinner />
      </OstoneShell>
    );
  }

  if (packQuery.isError) {
    const is404 = packQuery.error instanceof ApiRequestError && packQuery.error.status === 404;
    return (
      <OstoneShell active="domain" crumbs={buildSummaryCrumbs()}>
        <ErrorState
          message={is404 ? "Pack을 찾을 수 없습니다." : "Pack 정보를 불러오지 못했습니다."}
          onRetry={!is404 ? () => packQuery.refetch() : undefined}
        />
      </OstoneShell>
    );
  }

  return (
    <OstoneShell active="domain" crumbs={buildSummaryCrumbs()}>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
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
            selectedId={effectiveSelectedVersionId}
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
            applyingVersionId={
              activateMutation.isPending ? activateMutation.variables?.versionId : null
            }
            discardingVersionId={
              discardMutation.isPending ? discardMutation.variables?.draftVersionId : null
            }
            onDeploy={handleDeployVersion}
            onApplyDraft={handleApplyDraft}
            onDiscardDraft={handleDiscardDraft}
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

function resolveVersionActionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError && error.message) {
    return error.message;
  }
  return fallback;
}

function resolveDefaultVersionId(pack?: DomainPackDetail): number | null {
  const versions = pack?.versions?.filter((version) => version.versionId != null) ?? [];
  if (versions.length === 0) return null;

  if (
    pack?.currentVersionId != null &&
    versions.some((version) => version.versionId === pack.currentVersionId)
  ) {
    return pack.currentVersionId;
  }

  return (
    pickLatestVersionId(versions.filter((version) => version.lifecycleStatus === "DRAFT")) ??
    pickLatestVersionId(versions)
  );
}

function pickLatestVersionId(versions: DomainPackVersionSummary[]): number | null {
  const latest = versions.reduce<DomainPackVersionSummary | null>((best, version) => {
    if (version.versionId == null) return best;
    if (best === null) return version;
    return compareVersionSummary(version, best) > 0 ? version : best;
  }, null);

  return latest?.versionId ?? null;
}

function compareVersionSummary(
  left: DomainPackVersionSummary,
  right: DomainPackVersionSummary,
): number {
  const leftVersionNo = left.versionNo ?? Number.NEGATIVE_INFINITY;
  const rightVersionNo = right.versionNo ?? Number.NEGATIVE_INFINITY;
  if (leftVersionNo !== rightVersionNo) return leftVersionNo - rightVersionNo;

  const leftCreatedAt = parseTime(left.createdAt);
  const rightCreatedAt = parseTime(right.createdAt);
  if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt - rightCreatedAt;

  return (
    (left.versionId ?? Number.NEGATIVE_INFINITY) -
    (right.versionId ?? Number.NEGATIVE_INFINITY)
  );
}

function parseTime(value?: string): number {
  if (value == null) return Number.NEGATIVE_INFINITY;
  const time = Date.parse(value);
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

function resolveActivatedVersionId(result: unknown, fallback: number): number {
  if (!isRecord(result)) return fallback;
  if (typeof result.id === "number") return result.id;
  const data = result.data;
  if (isRecord(data) && typeof data.id === "number") return data.id;
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
