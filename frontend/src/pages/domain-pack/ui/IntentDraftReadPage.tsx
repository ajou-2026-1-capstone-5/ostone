import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  IntentDetailPanel,
  type IntentDetail,
  type IntentListState,
} from "@/entities/intent";
import {
  usePackDetail,
  VersionSafetyBanner,
} from "@/features/domain-pack-summary-read";
import {
  IntentTreePanel,
  MatchedWorkflowSection,
} from "@/features/intent-draft-read/ui";
import { useIntentList } from "@/features/intent-draft-read/model/useIntentList";
import { IntentDetailWithApproval } from "@/features/approve-intent";
import {
  IntentRevisionDiffPanel,
  IntentRevisionDraftActions,
  IntentRevisionEditAction,
  IntentRevisionEditForm,
  IntentRevisionRecoveryBanner,
} from "@/features/intent-revision-draft";
import {
  type ExistingDraftTarget,
  useIntentDraftReadController,
} from "@/pages/domain-pack/model/useIntentDraftReadController";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import { Pill, type PillTone } from "@/shared/ui/ostone/atoms";
import type { Crumb } from "@/shared/ui/ostone/chrome";
import { buildDomainPackCrumbs } from "@/shared/lib/domainPackRoutes";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { DomainPackShellState } from "./DomainPackShellState";
import styles from "./intent-draft-read-page.module.css";

const EMPTY_CRUMBS: Crumb[] = [];

export function IntentDraftReadPage() {
  const { workspaceId, packId, intentId } = useParams();
  const [search] = useSearchParams();

  const wsId = parseRouteId(workspaceId);
  const pId = parseRouteId(packId);
  const vId = parseRouteId(search.get("versionId") ?? undefined);
  const iId = intentId ? parseRouteId(intentId) : null;

  if (
    wsId === null ||
    pId === null ||
    vId === null ||
    (intentId !== undefined && iId === null)
  ) {
    return (
      <DomainPackShellState crumbs={EMPTY_CRUMBS}>
        <div className={styles.invalidParams} role="alert">
          잘못된 URL 파라미터입니다.
        </div>
      </DomainPackShellState>
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
  const controller = useIntentDraftReadController({ wsId, pId, vId, iId });
  const intentListState = useIntentList(
    wsId,
    pId,
    vId,
    controller.listRefreshKey,
  );
  const packDetail = usePackDetail(wsId, pId).data;
  const packName = packDetail?.name ?? `PACK · ${pId}`;
  const versionNo =
    packDetail?.versions?.find((v) => v.versionId === vId)?.versionNo ?? vId;

  const versionLabel = getVersionLabel({
    lifecycleStatus: controller.versionDetail?.lifecycleStatus,
    isCurrentPublished: controller.isCurrentPublished,
    isRevisionDraft: controller.isRevisionDraft,
  });

  const summaryState = controller.summaryState;

  const crumbs = useMemo<Crumb[]>(
    () =>
      buildDomainPackCrumbs({
        wsId,
        pId,
        vId,
        packName,
        versionNo,
        section: { label: "상담 유형", path: "intents" },
        selectedLabel: controller.selectedIntentCode,
      }),
    [wsId, pId, vId, packName, versionNo, controller.selectedIntentCode],
  );

  const topbarRight = useMemo(
    () => (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--s-3)",
        }}
      >
        <Pill tone={versionLabelTone(versionLabel)}>{versionLabel}</Pill>
        {controller.isRevisionDraft && (
          <IntentRevisionDraftActions
            summary={
              summaryState.status === "ready" ? summaryState.data : undefined
            }
            isSummaryLoading={summaryState.status === "loading"}
            summaryError={
              summaryState.status === "error" ? summaryState.message : null
            }
            isPending={controller.isMutationPending}
            onRetrySummary={controller.retrySummary}
          />
        )}
      </div>
    ),
    [
      controller.isMutationPending,
      controller.isRevisionDraft,
      controller.retrySummary,
      summaryState,
      versionLabel,
    ],
  );

  return (
    <DomainPackShellState crumbs={crumbs} topbarRight={topbarRight}>
      <div className={styles.pageWrapper}>
        <VersionSafetyBanner wsId={wsId} packId={pId} versionId={vId} />
        <IntentDraftTwoPane
          controller={controller}
          hasSelection={iId !== null}
          wsId={wsId}
          pId={pId}
          vId={vId}
          iId={iId}
          intentListState={intentListState}
        />
      </div>

      <PendingNavigationDialog controller={controller} />
      <ExistingDraftDialog controller={controller} />
    </DomainPackShellState>
  );
}

type IntentDraftController = ReturnType<typeof useIntentDraftReadController>;

function IntentDraftTwoPane({
  controller,
  hasSelection,
  wsId,
  pId,
  vId,
  iId,
  intentListState,
}: {
  controller: IntentDraftController;
  hasSelection: boolean;
  wsId: number;
  pId: number;
  vId: number;
  iId: number | null;
  intentListState: IntentListState;
}) {
  return (
    <div
      className={`${styles.twoPane} ${hasSelection ? styles.hasSelection : ""}`}
    >
      <div className={styles.listSlot}>
        <IntentTreePanel
          intentListState={intentListState}
          selectedId={iId}
          onSelect={controller.handleSelect}
          markers={controller.markers}
        />
      </div>
      <IntentDetailSlot
        controller={controller}
        wsId={wsId}
        pId={pId}
        vId={vId}
        iId={iId}
        intentListState={intentListState}
      />
    </div>
  );
}

function IntentDetailSlot({
  controller,
  wsId,
  pId,
  vId,
  iId,
  intentListState,
}: {
  controller: IntentDraftController;
  wsId: number;
  pId: number;
  vId: number;
  iId: number | null;
  intentListState: IntentListState;
}) {
  const [editingTarget, setEditingTarget] = useState<{
    intentId: number;
    versionId: number;
  } | null>(null);
  const isEditingIntent =
    editingTarget?.intentId === iId && editingTarget.versionId === vId;
  const setEditingIntent = useCallback(
    (next: boolean) => {
      setEditingTarget(
        next && iId !== null ? { intentId: iId, versionId: vId } : null,
      );
    },
    [iId, vId],
  );

  const renderMatchedWorkflows = (detail: IntentDetail) => (
    <MatchedWorkflowSection
      wsId={wsId}
      packId={pId}
      versionId={vId}
      intentId={detail.id ?? null}
    />
  );

  if (iId === null) {
    return (
      <div className={styles.detailSlot}>
        <IntentDetailPanel
          wsId={wsId}
          packId={pId}
          versionId={vId}
          intentId={null}
          intentListState={intentListState}
        />
      </div>
    );
  }

  if (controller.isGeneralDraft) {
    return (
      <div className={styles.detailSlot}>
        <IntentDetailWithApproval
          key={iId}
          wsId={wsId}
          pId={pId}
          vId={vId}
          iId={iId}
          intentListState={intentListState}
          afterHeader={(detail) => (
            <SelectedIntentCodeSync
              intentCode={detail.intentCode ?? null}
              onChange={controller.setSelectedIntentCode}
            />
          )}
        >
          {renderMatchedWorkflows}
        </IntentDetailWithApproval>
      </div>
    );
  }

  const detailSharedProps = {
    key: iId,
    wsId,
    packId: pId,
    versionId: vId,
    intentId: iId,
    intentListState,
    refreshKey: controller.detailRefreshKey,
    headerActions: (detail: IntentDetail) =>
      controller.canEditIntent && detail.id != null && !isEditingIntent ? (
        <IntentRevisionEditAction
          disabled={controller.isMutationPending}
          onEdit={() => setEditingIntent(true)}
        />
      ) : null,
    afterHeader: (detail: IntentDetail) => (
      <>
        <SelectedIntentCodeSync
          intentCode={detail.intentCode ?? null}
          onChange={controller.setSelectedIntentCode}
        />
        {controller.recoveryVersionId === vId ? (
          <IntentRevisionRecoveryBanner />
        ) : null}
      </>
    ),
    beforeJsonCards: () =>
      controller.isRevisionDraft ? (
        <IntentRevisionDiffPanel change={controller.selectedChange} />
      ) : null,
  };
  const renderRevisionEditor = (detail: IntentDetail) => (
    <>
      <IntentRevisionEditForm
        wsId={wsId}
        packId={pId}
        versionId={vId}
        detail={detail}
        canEdit={controller.canEditIntent}
        isSaving={controller.isMutationPending}
        isEditing={isEditingIntent}
        showIdleAction={false}
        onSave={(values) => controller.handleSaveRevision(detail, values)}
        onDirtyChange={controller.handleDirtyChange}
        onEditingChange={setEditingIntent}
      />
      {renderMatchedWorkflows(detail)}
    </>
  );

  if (controller.versionDetail?.lifecycleStatus === "PUBLISHED") {
    return (
      <div className={styles.detailSlot}>
        <IntentDetailWithApproval
          key={iId}
          wsId={wsId}
          pId={pId}
          vId={vId}
          iId={iId}
          intentListState={intentListState}
          refreshKey={controller.detailRefreshKey}
          afterHeader={detailSharedProps.afterHeader}
          beforeJsonCards={detailSharedProps.beforeJsonCards}
          nonDraftHeaderActions={detailSharedProps.headerActions}
        >
          {renderRevisionEditor}
        </IntentDetailWithApproval>
      </div>
    );
  }

  return (
    <div className={styles.detailSlot}>
      <IntentDetailPanel {...detailSharedProps}>
        {renderRevisionEditor}
      </IntentDetailPanel>
    </div>
  );
}

function PendingNavigationDialog({
  controller,
}: {
  controller: IntentDraftController;
}) {
  return (
    <AlertDialog
      open={controller.pendingNavigation !== null}
      onOpenChange={() => controller.setPendingNavigation(null)}
    >
      <AlertDialogContent size="sm">
        <AlertDialogTitle>저장하지 않고 이동할까요?</AlertDialogTitle>
        <AlertDialogDescription>
          저장하지 않고 이동 시 수정 내역은 사라집니다.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => controller.setPendingNavigation(null)}
          >
            취소
          </Button>
          <Button type="button" onClick={controller.confirmPendingNavigation}>
            이동
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ExistingDraftDialog({
  controller,
}: {
  controller: IntentDraftController;
}) {
  const target = controller.existingDraftTarget;

  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={() => controller.setExistingDraftTarget(null)}
    >
      <AlertDialogContent size="sm">
        <AlertDialogTitle>진행 중인 초안이 있습니다.</AlertDialogTitle>
        <AlertDialogDescription>
          이미 진행 중인 Draft가 있어 새 수정 초안을 만들 수 없습니다.{" "}
          {getExistingDraftDescription(target)}
        </AlertDialogDescription>
        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => controller.setExistingDraftTarget(null)}
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={controller.confirmExistingDraftNavigation}
          >
            이동
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SelectedIntentCodeSync({
  intentCode,
  onChange,
}: {
  intentCode: string | null;
  onChange: (intentCode: string | null) => void;
}) {
  useEffect(() => {
    onChange(intentCode);
    return () => onChange(null);
  }, [intentCode, onChange]);

  return null;
}

function versionLabelTone(label: string): PillTone {
  if (label === "운영 중") return "signal";
  if (label === "검토 중" || label === "상담 유형 수정 검토") return "warn";
  if (label === "이전 버전") return "mute";
  return "mute";
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
  if (isRevisionDraft) return "상담 유형 수정 검토";
  if (isCurrentPublished) return "운영 중";
  if (lifecycleStatus === "PUBLISHED") return "이전 버전";
  if (lifecycleStatus === "DRAFT") return "검토 중";
  return "확인 중";
}

function getExistingDraftDescription(
  target: ExistingDraftTarget | null,
): string {
  return target?.sourceType === "INTENT_REVISION"
    ? "기존 상담 유형 수정 검토본으로 이동하거나 도메인팩 화면에서 검토본을 적용 또는 폐기해 주세요."
    : "기존 검토본으로 이동하거나 도메인팩 화면에서 검토본을 적용 또는 폐기해 주세요.";
}
