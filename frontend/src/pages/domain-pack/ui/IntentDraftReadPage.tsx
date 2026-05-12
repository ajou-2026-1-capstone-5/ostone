import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { IntentDetailPanel, IntentTreePanel } from "@/features/intent-draft-read/ui";
import { IntentDetailWithApproval } from "@/features/approve-intent";
import {
  IntentRevisionDiffPanel,
  IntentRevisionDraftActions,
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
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { OstoneShell } from "@/widgets/ostone-shell";
import { Mono } from "@/shared/ui/ostone/atoms";
import styles from "./intent-draft-read-page.module.css";

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
  const controller = useIntentDraftReadController({ wsId, pId, vId, iId });
  const hasSelection = iId !== null;

  const versionLabel = getVersionLabel({
    lifecycleStatus: controller.versionDetail?.lifecycleStatus,
    isCurrentPublished: controller.isCurrentPublished,
    isRevisionDraft: controller.isRevisionDraft,
  });

  return (
    <OstoneShell active="domain" crumbs={[`PACK · ${pId}`, `Version · ${vId}`]}>
      <div className={styles.pageWrapper}>
        <IntentDraftHeader
          controller={controller}
          versionLabel={versionLabel}
          wsId={wsId}
          pId={pId}
          vId={vId}
        />
        {hasSelection && (
          <button type="button" className={styles.backButton} onClick={controller.handleBack}>
            ← 목록
          </button>
        )}
        <IntentDraftTwoPane
          controller={controller}
          hasSelection={hasSelection}
          wsId={wsId}
          pId={pId}
          vId={vId}
          iId={iId}
        />
      </div>

      <PendingNavigationDialog controller={controller} />
      <ExistingDraftDialog controller={controller} />
    </OstoneShell>
  );
}

type IntentDraftController = ReturnType<typeof useIntentDraftReadController>;

function IntentDraftHeader({
  controller,
  versionLabel,
  wsId,
  pId,
  vId,
}: {
  controller: IntentDraftController;
  versionLabel: string;
  wsId: number;
  pId: number;
  vId: number;
}) {
  const summaryState = controller.summaryState;

  return (
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
        {controller.isRevisionDraft && (
          <IntentRevisionDraftActions
            summary={summaryState.status === "ready" ? summaryState.data : undefined}
            isSummaryLoading={summaryState.status === "loading"}
            summaryError={summaryState.status === "error" ? summaryState.message : null}
            isPending={controller.isMutationPending}
            onRetrySummary={controller.retrySummary}
            onApply={controller.handleApplyRevisionDraftAction}
            onDiscard={controller.handleDiscardRevisionDraftAction}
          />
        )}
      </div>
    </header>
  );
}

function IntentDraftTwoPane({
  controller,
  hasSelection,
  wsId,
  pId,
  vId,
  iId,
}: {
  controller: IntentDraftController;
  hasSelection: boolean;
  wsId: number;
  pId: number;
  vId: number;
  iId: number | null;
}) {
  return (
    <div className={`${styles.twoPane} ${hasSelection ? styles.hasSelection : ""}`}>
      <div className={styles.listSlot}>
        <IntentTreePanel
          wsId={wsId}
          packId={pId}
          versionId={vId}
          selectedId={iId}
          onSelect={controller.handleSelect}
          refreshKey={controller.listRefreshKey}
          markers={controller.markers}
        />
      </div>
      <IntentDetailSlot controller={controller} wsId={wsId} pId={pId} vId={vId} iId={iId} />
    </div>
  );
}

function IntentDetailSlot({
  controller,
  wsId,
  pId,
  vId,
  iId,
}: {
  controller: IntentDraftController;
  wsId: number;
  pId: number;
  vId: number;
  iId: number | null;
}) {
  if (iId === null) {
    return (
      <div className={styles.detailSlot}>
        <IntentDetailPanel wsId={wsId} packId={pId} versionId={vId} intentId={null} />
      </div>
    );
  }

  if (controller.isGeneralDraft) {
    return (
      <div className={styles.detailSlot}>
        <IntentDetailWithApproval key={iId} wsId={wsId} pId={pId} vId={vId} iId={iId} />
      </div>
    );
  }

  return (
    <div className={styles.detailSlot}>
      <IntentDetailPanel
        key={iId}
        wsId={wsId}
        packId={pId}
        versionId={vId}
        intentId={iId}
        refreshKey={controller.detailRefreshKey}
        afterHeader={(detail) => (
          <>
            <SelectedIntentCodeSync
              intentCode={detail.intentCode ?? null}
              onChange={controller.setSelectedIntentCode}
            />
            {controller.recoveryVersionId === vId ? <IntentRevisionRecoveryBanner /> : null}
          </>
        )}
        beforeJsonCards={() =>
          controller.isRevisionDraft ? (
            <IntentRevisionDiffPanel change={controller.selectedChange} />
          ) : null
        }
      >
        {(detail) => (
          <IntentRevisionEditForm
            wsId={wsId}
            packId={pId}
            versionId={vId}
            detail={detail}
            canEdit={controller.canEditIntent}
            isSaving={controller.isMutationPending}
            onSave={(values) => controller.handleSaveRevision(detail, values)}
            onDirtyChange={controller.handleDirtyChange}
          />
        )}
      </IntentDetailPanel>
    </div>
  );
}

function PendingNavigationDialog({ controller }: { controller: IntentDraftController }) {
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

function ExistingDraftDialog({ controller }: { controller: IntentDraftController }) {
  const target = controller.existingDraftTarget;

  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={() => controller.setExistingDraftTarget(null)}
    >
      <AlertDialogContent size="sm">
        <AlertDialogTitle>진행 중인 초안이 있습니다.</AlertDialogTitle>
        <AlertDialogDescription>
          저장하지 않고 이동 시 수정 내역은 사라집니다. {getExistingDraftDescription(target)}
        </AlertDialogDescription>
        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => controller.setExistingDraftTarget(null)}
          >
            취소
          </Button>
          <Button type="button" onClick={controller.confirmExistingDraftNavigation}>
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

function getExistingDraftDescription(target: ExistingDraftTarget | null): string {
  return target?.sourceType === "INTENT_REVISION"
    ? "기존 Intent 수정 초안으로 이동할까요?"
    : "기존 초안으로 이동할까요?";
}
