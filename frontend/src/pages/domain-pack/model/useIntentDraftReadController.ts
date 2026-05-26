import { useCallback, useEffect, useMemo, useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type {
  DomainPackDetail,
  DomainPackVersionDetail,
} from "@/entities/domain-pack";
import type { IntentDetail } from "@/entities/intent";
import {
  usePackDetail,
  useVersionDetail,
} from "@/features/domain-pack-summary-read";
import {
  domainPackSectionPath,
  shouldReplaceDomainPackChildRoute,
} from "@/shared/lib/domainPackRoutes";
import {
  classifyExistingDraftSource,
  intentRevisionDraftApi,
  parseIntentRevisionDraftSource,
  resolveSingleExistingDraft,
  useIntentRevisionMarkers,
  useIntentRevisionSummary,
  useSaveIntentRevisionDraft,
  useUpdateDraftIntent,
  type UpdateDraftIntentBody,
} from "@/features/intent-revision-draft";
import { ApiRequestError } from "@/shared/api";

interface DirtyState {
  isDirty: boolean;
  intentId: number | null;
}

export interface ExistingDraftTarget {
  versionId: number;
  intentCode: string;
  sourceType: "INTENT_REVISION" | "GENERAL_DRAFT";
}

interface IntentDraftReadControllerParams {
  wsId: number;
  pId: number;
  vId: number;
  iId: number | null;
}

interface IntentRouteNavigationOptions {
  replace?: boolean;
}

export function useIntentDraftReadController({
  wsId,
  pId,
  vId,
  iId,
}: IntentDraftReadControllerParams) {
  const navigate = useNavigate();
  const packQuery = usePackDetail(
    wsId,
    pId,
  ) as UseQueryResult<DomainPackDetail>;
  const versionQuery = useVersionDetail(
    wsId,
    pId,
    vId,
  ) as UseQueryResult<DomainPackVersionDetail>;
  const { saveIntentRevisionDraft, isPending: isCreatingRevision } =
    useSaveIntentRevisionDraft();
  const { updateDraftIntent, isPending: isUpdatingDraft } =
    useUpdateDraftIntent();
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);
  const [versionActionPending, setVersionActionPending] = useState(false);
  const [dirtyState, setDirtyState] = useState<DirtyState>({
    isDirty: false,
    intentId: null,
  });
  const [pendingNavigation, setPendingNavigation] = useState<
    (() => void) | null
  >(null);
  const [existingDraftTarget, setExistingDraftTarget] =
    useState<ExistingDraftTarget | null>(null);
  const [recoveryVersionId, setRecoveryVersionId] = useState<number | null>(
    null,
  );
  const [selectedIntentCode, setSelectedIntentCode] = useState<string | null>(
    null,
  );

  const currentPublishedVersion = useCurrentPublishedVersion(
    packQuery.data?.versions,
  );
  const versionDetail = versionQuery.data;
  const revisionSource = parseIntentRevisionDraftSource(
    versionDetail?.summaryJson,
  );
  const isRevisionDraft =
    versionDetail?.lifecycleStatus === "DRAFT" &&
    revisionSource?.type === "INTENT_REVISION";
  const isCurrentPublished =
    versionDetail?.lifecycleStatus === "PUBLISHED" &&
    currentPublishedVersion?.versionId === versionDetail.versionId;
  const isGeneralDraft =
    versionDetail?.lifecycleStatus === "DRAFT" && !isRevisionDraft;
  const canEditIntent = isCurrentPublished || isRevisionDraft;

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
  const handleDirtyChange = useCallback(
    (isDirty: boolean, intentId: number | null) => {
      setDirtyState({ isDirty, intentId });
    },
    [],
  );

  useBeforeUnloadGuard(dirtyState.isDirty);

  const navigateToIntentRoute = useCallback(
    (
      versionId: number,
      intentId: number | null,
      options?: IntentRouteNavigationOptions,
    ) => {
      const path = domainPackSectionPath(
        wsId,
        pId,
        versionId,
        "intents",
        intentId ?? undefined,
      );
      if (options?.replace ?? shouldReplaceDomainPackChildRoute(iId)) {
        navigate(path, { replace: true });
        return;
      }
      navigate(path);
    },
    [iId, navigate, pId, wsId],
  );
  const navigateToIntentCode = useCallback(
    async (
      versionId: number,
      intentCode?: string | null,
      options?: IntentRouteNavigationOptions,
    ) => {
      if (!intentCode) {
        navigateToIntentRoute(versionId, null, options);
        return;
      }

      try {
        const intents = await intentRevisionDraftApi.listIntents(
          wsId,
          pId,
          versionId,
        );
        const target = intents.find(
          (intent) => intent.intentCode === intentCode,
        );
        navigateToIntentRoute(versionId, target?.id ?? null, options);
      } catch {
        navigateToIntentRoute(versionId, null, options);
      }
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
  const refreshIntentViews = useCallback(() => {
    setDetailRefreshKey((key) => key + 1);
    setListRefreshKey((key) => key + 1);
    setSummaryRefreshKey((key) => key + 1);
  }, []);

  const resolveExistingDraftTarget = useResolveExistingDraftTarget({
    wsId,
    pId,
    packQuery,
    setExistingDraftTarget,
  });
  const handleSaveRevision = useSaveRevisionHandler({
    wsId,
    pId,
    vId,
    isCurrentPublished,
    isRevisionDraft,
    packQuery,
    saveIntentRevisionDraft,
    updateDraftIntent,
    resetDirty,
    refreshIntentViews,
    navigateToIntentRoute,
    resolveExistingDraftTarget,
    setRecoveryVersionId,
  });
  const handleApplyRevisionDraft = useApplyRevisionDraftHandler({
    wsId,
    pId,
    vId,
    summaryState,
    packQuery,
    versionQuery,
    refreshIntentViews,
    navigateToIntentCode,
    setVersionActionPending,
  });
  const handleDiscardRevisionDraft = useDiscardRevisionDraftHandler({
    wsId,
    pId,
    vId,
    currentPublishedVersionId: currentPublishedVersion?.versionId ?? null,
    baseVersionId: revisionSource?.baseVersionId ?? null,
    packQuery,
    navigate,
    navigateToIntentCode,
    setVersionActionPending,
  });

  return {
    canEditIntent,
    detailRefreshKey,
    existingDraftTarget,
    handleDirtyChange,
    isCurrentPublished,
    isGeneralDraft,
    isMutationPending:
      isCreatingRevision || isUpdatingDraft || versionActionPending,
    isRevisionDraft,
    listRefreshKey,
    markers,
    pendingNavigation,
    recoveryVersionId,
    selectedChange:
      iId !== null && summaryState.status === "ready"
        ? summaryState.data.changedByDraftIntentId[iId]
        : undefined,
    selectedIntentCode,
    setExistingDraftTarget,
    setPendingNavigation,
    setSelectedIntentCode,
    summaryState,
    versionDetail,
    confirmExistingDraftNavigation: () => {
      const target = existingDraftTarget;
      setExistingDraftTarget(null);
      resetDirty();
      if (target)
        void navigateToIntentCode(target.versionId, target.intentCode);
    },
    confirmPendingNavigation: () => {
      const next = pendingNavigation;
      setPendingNavigation(null);
      resetDirty();
      next?.();
    },
    handleApplyRevisionDraftAction: () => {
      guardNavigation(() => void handleApplyRevisionDraft(selectedIntentCode));
    },
    handleBack: () => {
      guardNavigation(() => navigateToIntentRoute(vId, null));
    },
    handleDiscardRevisionDraftAction: () => {
      guardNavigation(
        () => void handleDiscardRevisionDraft(selectedIntentCode),
      );
    },
    handleSaveRevision,
    handleSelect: (id: number) => {
      guardNavigation(() => navigateToIntentRoute(vId, id));
    },
    retrySummary: () => setSummaryRefreshKey((key) => key + 1),
  };
}

function useCurrentPublishedVersion(
  versions: DomainPackDetail["versions"] | undefined,
) {
  return useMemo(() => {
    return (versions ?? [])
      .filter(
        (version) =>
          version.lifecycleStatus === "PUBLISHED" && version.versionId != null,
      )
      .reduce<NonNullable<DomainPackDetail["versions"]>[number] | null>(
        (current, version) => {
          if (!current) return version;
          return (version.versionNo ?? 0) > (current.versionNo ?? 0)
            ? version
            : current;
        },
        null,
      );
  }, [versions]);
}

function useBeforeUnloadGuard(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);
}

function useResolveExistingDraftTarget({
  wsId,
  pId,
  packQuery,
  setExistingDraftTarget,
}: {
  wsId: number;
  pId: number;
  packQuery: UseQueryResult<DomainPackDetail>;
  setExistingDraftTarget: (target: ExistingDraftTarget | null) => void;
}) {
  return useCallback(
    async (intentCode: string): Promise<boolean> => {
      try {
        const refetched = await packQuery.refetch();
        const resolution = resolveSingleExistingDraft(refetched.data?.versions);

        if (resolution.status === "invalid") {
          toast.error(
            "초안 상태를 확인할 수 없습니다. 목록을 새로고침해 주세요.",
          );
          return false;
        }

        const draftDetail = await intentRevisionDraftApi.getVersionDetail(
          wsId,
          pId,
          resolution.versionId,
        );
        setExistingDraftTarget({
          versionId: resolution.versionId,
          intentCode,
          sourceType: classifyExistingDraftSource(draftDetail.summaryJson),
        });
        return true;
      } catch {
        toast.error(
          "진행 중인 초안을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
        return false;
      }
    },
    [pId, packQuery, setExistingDraftTarget, wsId],
  );
}

function useSaveRevisionHandler({
  wsId,
  pId,
  vId,
  isCurrentPublished,
  isRevisionDraft,
  packQuery,
  saveIntentRevisionDraft,
  updateDraftIntent,
  resetDirty,
  refreshIntentViews,
  navigateToIntentRoute,
  resolveExistingDraftTarget,
  setRecoveryVersionId,
}: {
  wsId: number;
  pId: number;
  vId: number;
  isCurrentPublished: boolean;
  isRevisionDraft: boolean;
  packQuery: UseQueryResult<DomainPackDetail>;
  saveIntentRevisionDraft: ReturnType<
    typeof useSaveIntentRevisionDraft
  >["saveIntentRevisionDraft"];
  updateDraftIntent: ReturnType<
    typeof useUpdateDraftIntent
  >["updateDraftIntent"];
  resetDirty: () => void;
  refreshIntentViews: () => void;
  navigateToIntentRoute: (versionId: number, intentId: number | null) => void;
  resolveExistingDraftTarget: (intentCode: string) => Promise<boolean>;
  setRecoveryVersionId: (versionId: number | null) => void;
}) {
  return useCallback(
    async (
      detail: IntentDetail,
      values: UpdateDraftIntentBody,
    ): Promise<boolean> => {
      if (detail.id == null || !detail.intentCode) return false;

      if (isCurrentPublished) {
        return savePublishedIntentRevision({
          wsId,
          pId,
          vId,
          detail,
          values,
          packQuery,
          saveIntentRevisionDraft,
          resetDirty,
          navigateToIntentRoute,
          resolveExistingDraftTarget,
          setRecoveryVersionId,
        });
      }

      if (!isRevisionDraft) return false;

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
        toast.success("Intent 수정 내용이 저장되었습니다.");
        return true;
      } catch (error) {
        toast.error(
          resolveApiErrorMessage(
            error,
            "Intent 수정 내용 저장에 실패했습니다.",
          ),
        );
        return false;
      }
    },
    [
      isCurrentPublished,
      isRevisionDraft,
      navigateToIntentRoute,
      pId,
      packQuery,
      refreshIntentViews,
      resetDirty,
      resolveExistingDraftTarget,
      saveIntentRevisionDraft,
      setRecoveryVersionId,
      updateDraftIntent,
      vId,
      wsId,
    ],
  );
}

async function savePublishedIntentRevision({
  wsId,
  pId,
  vId,
  detail,
  values,
  packQuery,
  saveIntentRevisionDraft,
  resetDirty,
  navigateToIntentRoute,
  resolveExistingDraftTarget,
  setRecoveryVersionId,
}: {
  wsId: number;
  pId: number;
  vId: number;
  detail: IntentDetail;
  values: UpdateDraftIntentBody;
  packQuery: UseQueryResult<DomainPackDetail>;
  saveIntentRevisionDraft: ReturnType<
    typeof useSaveIntentRevisionDraft
  >["saveIntentRevisionDraft"];
  resetDirty: () => void;
  navigateToIntentRoute: (versionId: number, intentId: number | null) => void;
  resolveExistingDraftTarget: (intentCode: string) => Promise<boolean>;
  setRecoveryVersionId: (versionId: number | null) => void;
}): Promise<boolean> {
  try {
    const result = await saveIntentRevisionDraft({
      workspaceId: wsId,
      packId: pId,
      baseVersionId: vId,
      intentCode: detail.intentCode!,
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
    if (result.patchSucceeded) {
      toast.success("Intent 수정 초안이 생성되었습니다.");
    }
    return true;
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      error.code === "DOMAIN_PACK_DRAFT_ALREADY_EXISTS"
    ) {
      await resolveExistingDraftTarget(detail.intentCode!);
      return false;
    }

    if (
      error instanceof ApiRequestError &&
      error.code === "DOMAIN_PACK_VERSION_NOT_CURRENT"
    ) {
      await packQuery.refetch();
      toast.error(
        "현재 운영 버전이 변경되었습니다. 최신 버전에서 다시 수정해 주세요.",
      );
      return false;
    }

    toast.error(
      resolveApiErrorMessage(error, "Intent 수정 내용 저장에 실패했습니다."),
    );
    return false;
  }
}

function useApplyRevisionDraftHandler({
  wsId,
  pId,
  vId,
  summaryState,
  packQuery,
  versionQuery,
  refreshIntentViews,
  navigateToIntentCode,
  setVersionActionPending,
}: {
  wsId: number;
  pId: number;
  vId: number;
  summaryState: ReturnType<typeof useIntentRevisionSummary>;
  packQuery: UseQueryResult<DomainPackDetail>;
  versionQuery: UseQueryResult<DomainPackVersionDetail>;
  refreshIntentViews: () => void;
  navigateToIntentCode: (
    versionId: number,
    intentCode?: string | null,
    options?: IntentRouteNavigationOptions,
  ) => Promise<void>;
  setVersionActionPending: (isPending: boolean) => void;
}) {
  return useCallback(
    async (intentCode?: string | null) => {
      const summary =
        summaryState.status === "ready" ? summaryState.data : null;
      if (!summary || summary.changedIntents.length === 0) return;

      setVersionActionPending(true);
      try {
        const activated = await intentRevisionDraftApi.activateVersion(
          wsId,
          pId,
          vId,
        );
        await Promise.all([packQuery.refetch(), versionQuery.refetch()]);
        refreshIntentViews();
        toast.success("Intent 수정 초안이 적용되었습니다.");
        await navigateToIntentCode(activated.activatedVersionId, intentCode, {
          replace: true,
        });
      } catch (error) {
        toast.error(
          resolveApiErrorMessage(
            error,
            "Intent 수정 초안 적용에 실패했습니다.",
          ),
        );
      } finally {
        setVersionActionPending(false);
      }
    },
    [
      navigateToIntentCode,
      pId,
      packQuery,
      refreshIntentViews,
      setVersionActionPending,
      summaryState,
      vId,
      versionQuery,
      wsId,
    ],
  );
}

function useDiscardRevisionDraftHandler({
  wsId,
  pId,
  vId,
  currentPublishedVersionId,
  baseVersionId,
  packQuery,
  navigate,
  navigateToIntentCode,
  setVersionActionPending,
}: {
  wsId: number;
  pId: number;
  vId: number;
  currentPublishedVersionId: number | null;
  baseVersionId: number | null;
  packQuery: UseQueryResult<DomainPackDetail>;
  navigate: ReturnType<typeof useNavigate>;
  navigateToIntentCode: (
    versionId: number,
    intentCode?: string | null,
    options?: IntentRouteNavigationOptions,
  ) => Promise<void>;
  setVersionActionPending: (isPending: boolean) => void;
}) {
  return useCallback(
    async (intentCode?: string | null) => {
      setVersionActionPending(true);
      try {
        await intentRevisionDraftApi.discardDraft(wsId, pId, vId);
        const targetVersionId = currentPublishedVersionId ?? baseVersionId;
        await packQuery.refetch();
        toast.success("Intent 수정 초안이 취소되었습니다.");
        if (targetVersionId !== null) {
          await navigateToIntentCode(targetVersionId, intentCode, {
            replace: true,
          });
        } else {
          navigate(`/workspaces/${wsId}/domain-packs/${pId}`, {
            replace: true,
          });
        }
      } catch (error) {
        toast.error(
          resolveApiErrorMessage(
            error,
            "Intent 수정 초안 취소에 실패했습니다.",
          ),
        );
      } finally {
        setVersionActionPending(false);
      }
    },
    [
      baseVersionId,
      currentPublishedVersionId,
      navigate,
      navigateToIntentCode,
      pId,
      packQuery,
      setVersionActionPending,
      vId,
      wsId,
    ],
  );
}

function resolveApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError && error.message) {
    return error.message;
  }
  return fallback;
}
