import { useCallback, useEffect, useMemo, useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import type { DomainPackDetail, DomainPackVersionDetail } from "@/entities/domain-pack";
import type { IntentDetail } from "@/entities/intent";
import { IntentDetailPanel, IntentTreePanel } from "@/features/intent-draft-read/ui";
import { IntentDetailWithApproval } from "@/features/approve-intent";
import { usePackDetail, useVersionDetail } from "@/features/domain-pack-summary-read";
import {
  IntentRevisionDiffPanel,
  IntentRevisionDraftActions,
  IntentRevisionEditForm,
  IntentRevisionRecoveryBanner,
  intentRevisionDraftApi,
  parseIntentRevisionDraftSource,
  useIntentRevisionMarkers,
  useIntentRevisionSummary,
  useSaveIntentRevisionDraft,
  useUpdateDraftIntent,
  type UpdateDraftIntentBody,
} from "@/features/intent-revision-draft";
import { ApiRequestError } from "@/shared/api";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { OstoneShell } from "@/widgets/ostone-shell";
import { Mono } from "@/shared/ui/ostone/atoms";
import styles from "./intent-draft-read-page.module.css";

interface DirtyState {
  isDirty: boolean;
  intentId: number | null;
}

interface ExistingDraftTarget {
  versionId: number;
  intentCode: string;
}

export function IntentDraftReadPage() {
  const { workspaceId, packId, versionId, intentId } = useParams();

  const wsId = parseRouteId(workspaceId);
  const pId = parseRouteId(packId);
  const vId = parseRouteId(versionId);
  const iId = intentId ? parseRouteId(intentId) : null;

  if (wsId === null || pId === null || vId === null || (intentId !== undefined && iId === null)) {
    return (
      <OstoneShell active="domain" crumbs={[]}>
        <div className={styles.invalidParams} role="alert">
          잘못된 URL 파라미터입니다.
        </div>
      </OstoneShell>
    );
  }

  return <IntentDraftReadContent wsId={wsId} pId={pId} vId={vId} iId={iId} />;
}

function IntentDraftReadContent({
  wsId,
  pId,
  vId,
  iId,
}: {
  wsId: number;
  pId: number;
  vId: number;
  iId: number | null;
}) {
  const navigate = useNavigate();
  const packQuery = usePackDetail(wsId, pId) as UseQueryResult<DomainPackDetail>;
  const versionQuery = useVersionDetail(wsId, pId, vId) as UseQueryResult<DomainPackVersionDetail>;
  const { saveIntentRevisionDraft, isPending: isCreatingRevision } = useSaveIntentRevisionDraft();
  const { updateDraftIntent, isPending: isUpdatingDraft } = useUpdateDraftIntent();
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);
  const [versionActionPending, setVersionActionPending] = useState(false);
  const [dirtyState, setDirtyState] = useState<DirtyState>({ isDirty: false, intentId: null });
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [existingDraftTarget, setExistingDraftTarget] = useState<ExistingDraftTarget | null>(null);
  const [recoveryVersionId, setRecoveryVersionId] = useState<number | null>(null);

  const currentPublishedVersion = useMemo(() => {
    const versions = packQuery.data?.versions ?? [];
    return versions
      .filter((version) => version.lifecycleStatus === "PUBLISHED" && version.versionId != null)
      .reduce<NonNullable<DomainPackDetail["versions"]>[number] | null>((current, version) => {
        if (!current) return version;
        return (version.versionNo ?? 0) > (current.versionNo ?? 0) ? version : current;
      }, null);
  }, [packQuery.data?.versions]);

  const versionDetail = versionQuery.data;
  const revisionSource = parseIntentRevisionDraftSource(versionDetail?.summaryJson);
  const isRevisionDraft =
    versionDetail?.lifecycleStatus === "DRAFT" && revisionSource?.type === "INTENT_REVISION";
  const isCurrentPublished =
    versionDetail?.lifecycleStatus === "PUBLISHED" &&
    currentPublishedVersion?.versionId === versionDetail.versionId;
  const isGeneralDraft = versionDetail?.lifecycleStatus === "DRAFT" && !isRevisionDraft;
  const canEditIntent = isCurrentPublished || isRevisionDraft;
  const hasSelection = iId !== null;

  const summaryState = useIntentRevisionSummary({
    workspaceId: wsId,
    packId: pId,
    draftVersionId: vId,
    baseVersionId: revisionSource?.baseVersionId ?? null,
    refreshKey: summaryRefreshKey,
    enabled: isRevisionDraft,
  });

  const markers = useIntentRevisionMarkers({
    editingIntentId: dirtyState.intentId,
    isDirty: dirtyState.isDirty,
    summaryState,
  });

  const resetDirty = useCallback(() => {
    setDirtyState({ isDirty: false, intentId: null });
  }, []);

  const handleDirtyChange = useCallback((isDirty: boolean, intentId: number | null) => {
    setDirtyState({ isDirty, intentId });
  }, []);

  useEffect(() => {
    if (!dirtyState.isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirtyState.isDirty]);

  const navigateToIntentRoute = useCallback(
    (versionId: number, intentId: number | null) => {
      const suffix = intentId === null ? "" : `/${intentId}`;
      navigate(`/workspaces/${wsId}/domain-packs/${pId}/versions/${versionId}/intents${suffix}`);
    },
    [navigate, pId, wsId],
  );

  const navigateToIntentCode = useCallback(
    async (versionId: number, intentCode?: string | null) => {
      if (!intentCode) {
        navigateToIntentRoute(versionId, null);
        return;
      }

      const intents = await intentRevisionDraftApi.listIntents(wsId, pId, versionId);
      const target = intents.find((intent) => intent.intentCode === intentCode);
      navigateToIntentRoute(versionId, target?.id ?? null);
    },
    [navigateToIntentRoute, pId, wsId],
  );

  const guardNavigation = useCallback(
    (next: () => void) => {
      if (!dirtyState.isDirty) {
        next();
        return;
      }
      setPendingNavigation(() => next);
    },
    [dirtyState.isDirty],
  );

  const handleSelect = (id: number) => {
    guardNavigation(() => navigateToIntentRoute(vId, id));
  };

  const handleBack = () => {
    guardNavigation(() => navigateToIntentRoute(vId, null));
  };

  const refreshIntentViews = () => {
    setDetailRefreshKey((key) => key + 1);
    setListRefreshKey((key) => key + 1);
    setSummaryRefreshKey((key) => key + 1);
  };

  const resolveExistingDraftTarget = async (intentCode: string) => {
    const refetched = await packQuery.refetch();
    const drafts = (refetched.data?.versions ?? []).filter(
      (version) => version.lifecycleStatus === "DRAFT" && version.versionId != null,
    );

    if (drafts.length !== 1 || drafts[0].versionId == null) {
      toast.error("초안 상태를 확인할 수 없습니다. 목록을 새로고침해 주세요.");
      return;
    }

    await intentRevisionDraftApi.getVersionDetail(wsId, pId, drafts[0].versionId);
    setExistingDraftTarget({ versionId: drafts[0].versionId, intentCode });
  };

  const handleSaveRevision = async (detail: IntentDetail, values: UpdateDraftIntentBody) => {
    if (detail.id == null || !detail.intentCode) return;

    if (isCurrentPublished) {
      try {
        const result = await saveIntentRevisionDraft({
          workspaceId: wsId,
          packId: pId,
          baseVersionId: vId,
          intentCode: detail.intentCode,
          values,
        });

        resetDirty();
        await packQuery.refetch();
        if (!result.patchSucceeded) {
          toast.error(
            result.clonedIntentId === null
              ? "Intent 수정 초안에서 같은 intent를 찾지 못했습니다."
              : "Intent 수정 초안은 생성됐지만 수정 내용 저장에 실패했습니다.",
          );
          setRecoveryVersionId(result.draftVersionId);
        }
        navigateToIntentRoute(result.draftVersionId, result.clonedIntentId);
      } catch (error) {
        if (
          error instanceof ApiRequestError &&
          error.code === "DOMAIN_PACK_DRAFT_ALREADY_EXISTS"
        ) {
          await resolveExistingDraftTarget(detail.intentCode);
          return;
        }

        if (
          error instanceof ApiRequestError &&
          error.code === "DOMAIN_PACK_VERSION_NOT_CURRENT"
        ) {
          await packQuery.refetch();
          toast.error("현재 운영 버전이 변경되었습니다. 최신 버전에서 다시 수정해 주세요.");
          return;
        }

        toast.error("Intent 수정 내용 저장에 실패했습니다.");
      }
      return;
    }

    if (isRevisionDraft) {
      try {
        await updateDraftIntent({
          workspaceId: wsId,
          packId: pId,
          draftVersionId: vId,
          intentId: detail.id,
          values,
        });
        resetDirty();
        refreshIntentViews();
      } catch {
        toast.error("Intent 수정 내용 저장에 실패했습니다.");
      }
    }
  };

  const handleApplyRevisionDraft = async (detail: IntentDetail) => {
    const summary = summaryState.status === "ready" ? summaryState.data : null;
    if (!summary || summary.changedIntents.length === 0) return;

    setVersionActionPending(true);
    try {
      const activated = await intentRevisionDraftApi.activateVersion(wsId, pId, vId);
      await packQuery.refetch();
      await versionQuery.refetch();
      toast.success("Intent 수정 초안이 적용되었습니다.");
      await navigateToIntentCode(activated.versionId ?? vId, detail.intentCode);
    } catch {
      toast.error("Intent 수정 초안 적용에 실패했습니다.");
    } finally {
      setVersionActionPending(false);
    }
  };

  const handleDiscardRevisionDraft = async (detail: IntentDetail) => {
    setVersionActionPending(true);
    try {
      await intentRevisionDraftApi.discardDraft(wsId, pId, vId);
      const targetVersionId =
        currentPublishedVersion?.versionId ?? revisionSource?.baseVersionId ?? null;
      await packQuery.refetch();
      toast.success("Intent 수정 초안이 취소되었습니다.");
      if (targetVersionId !== null) {
        await navigateToIntentCode(targetVersionId, detail.intentCode);
      } else {
        navigate(`/workspaces/${wsId}/domain-packs/${pId}`);
      }
    } catch {
      toast.error("Intent 수정 초안 취소에 실패했습니다.");
    } finally {
      setVersionActionPending(false);
    }
  };

  const versionLabel = getVersionLabel({
    lifecycleStatus: versionDetail?.lifecycleStatus,
    isCurrentPublished,
    isRevisionDraft,
  });

  const selectedChange =
    iId !== null && summaryState.status === "ready"
      ? summaryState.data.changedByDraftIntentId[iId]
      : undefined;

  const isMutationPending = isCreatingRevision || isUpdatingDraft || versionActionPending;

  return (
    <OstoneShell active="domain" crumbs={[`PACK · ${pId}`, `Version · ${vId}`]}>
      <div className={styles.pageWrapper}>
        <header className={styles.pageHeader}>
          <nav className={styles.breadcrumb} aria-label="경로">
            <Mono>WS · {wsId}</Mono>
            <span className={styles.breadcrumbSeparator}>/</span>
            <Mono>PACK · {pId}</Mono>
            <span className={styles.breadcrumbSeparator}>/</span>
            <Mono>VER · {vId}</Mono>
          </nav>
          <div className={styles.versionMeta}>
            <span className={styles.versionTitle}>Intent 조회</span>
            <span className={styles.versionBadge}>{versionLabel}</span>
          </div>
        </header>
        {hasSelection && (
          <button type="button" className={styles.backButton} onClick={handleBack}>
            ← 목록
          </button>
        )}
        <div className={`${styles.twoPane} ${hasSelection ? styles.hasSelection : ""}`}>
          <div className={styles.listSlot}>
            <IntentTreePanel
              wsId={wsId}
              packId={pId}
              versionId={vId}
              selectedId={iId}
              onSelect={handleSelect}
              refreshKey={listRefreshKey}
              markers={markers}
            />
          </div>
          <div className={styles.detailSlot}>
            {iId !== null ? (
              isGeneralDraft ? (
                <IntentDetailWithApproval key={iId} wsId={wsId} pId={pId} vId={vId} iId={iId} />
              ) : (
                <IntentDetailPanel
                  key={iId}
                  wsId={wsId}
                  packId={pId}
                  versionId={vId}
                  intentId={iId}
                  refreshKey={detailRefreshKey}
                  headerActions={(detail) =>
                    isRevisionDraft ? (
                      <IntentRevisionDraftActions
                        summary={summaryState.status === "ready" ? summaryState.data : undefined}
                        isSummaryLoading={summaryState.status === "loading"}
                        isPending={isMutationPending}
                        onApply={() => void handleApplyRevisionDraft(detail)}
                        onDiscard={() => void handleDiscardRevisionDraft(detail)}
                      />
                    ) : undefined
                  }
                  afterHeader={() =>
                    recoveryVersionId === vId ? <IntentRevisionRecoveryBanner /> : null
                  }
                  beforeJsonCards={() =>
                    isRevisionDraft ? <IntentRevisionDiffPanel change={selectedChange} /> : null
                  }
                >
                  {(detail) => (
                    <IntentRevisionEditForm
                      wsId={wsId}
                      packId={pId}
                      versionId={vId}
                      detail={detail}
                      canEdit={canEditIntent}
                      isSaving={isMutationPending}
                      onSave={(values) => handleSaveRevision(detail, values)}
                      onDirtyChange={handleDirtyChange}
                    />
                  )}
                </IntentDetailPanel>
              )
            ) : (
              <IntentDetailPanel wsId={wsId} packId={pId} versionId={vId} intentId={null} />
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={pendingNavigation !== null} onOpenChange={() => setPendingNavigation(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogTitle>저장하지 않고 이동할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            저장하지 않고 이동 시 수정 내역은 사라집니다.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingNavigation(null)}>
              취소
            </Button>
            <Button
              type="button"
              onClick={() => {
                const next = pendingNavigation;
                setPendingNavigation(null);
                resetDirty();
                next?.();
              }}
            >
              이동
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={existingDraftTarget !== null}
        onOpenChange={() => setExistingDraftTarget(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogTitle>진행 중인 초안이 있습니다.</AlertDialogTitle>
          <AlertDialogDescription>
            저장하지 않고 이동 시 수정 내역은 사라집니다. 기존 초안으로 이동할까요?
          </AlertDialogDescription>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => setExistingDraftTarget(null)}>
              취소
            </Button>
            <Button
              type="button"
              onClick={() => {
                const target = existingDraftTarget;
                setExistingDraftTarget(null);
                resetDirty();
                if (target) void navigateToIntentCode(target.versionId, target.intentCode);
              }}
            >
              이동
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </OstoneShell>
  );
}

function getVersionLabel({
  lifecycleStatus,
  isCurrentPublished,
  isRevisionDraft,
}: {
  lifecycleStatus?: string;
  isCurrentPublished: boolean;
  isRevisionDraft: boolean;
}): string {
  if (isRevisionDraft) return "Intent 수정 검토";
  if (isCurrentPublished) return "운영 중";
  if (lifecycleStatus === "PUBLISHED") return "이전 버전";
  if (lifecycleStatus === "DRAFT") return "DRAFT";
  return "확인 중";
}
