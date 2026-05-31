import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { usePackDetail } from "@/features/domain-pack-summary-read";
import { InlineWorkflowEditor } from "@/features/update-workflow";
import { intentRevisionDraftApi } from "@/features/intent-revision-draft";
import { buildDomainPackCrumbs, domainPackSectionPath } from "@/shared/lib/domainPackRoutes";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { OstoneShell } from "@/widgets/ostone-shell";
import { Pill, Mono, Icon } from "@/shared/ui/ostone/atoms";
import type { Crumb } from "@/shared/ui/ostone/chrome";
import { Button } from "@/shared/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { LoadingSpinner } from "@/shared/ui/ostone/atoms/LoadingSpinner";
import { ErrorState } from "@/shared/ui/ostone/atoms/ErrorState";
import { EmptyState } from "@/shared/ui/ostone/atoms/EmptyState";
import { useGetWorkflowDefinition } from "@/entities/workflow";
import type { WorkflowGraph } from "@/entities/workflow";
import { ApiRequestError } from "@/shared/api";
import { listWorkflows } from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";
import type { WorkflowDefinitionSummary } from "@/shared/api/generated/zod";
import { unwrapApiResponse } from "@/shared/api/unwrapApiResponse";
import { GraphViewer } from "@/features/workflow-viewer/ui/GraphViewer";
import styles from "./workflow-draft-read-page.module.css";

function isWorkflowGraph(v: unknown): v is WorkflowGraph {
  return (
    typeof v === "object" &&
    v !== null &&
    Array.isArray((v as { nodes?: unknown }).nodes) &&
    Array.isArray((v as { edges?: unknown }).edges)
  );
}

function parseGraphJson(raw: unknown): WorkflowGraph | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      return isWorkflowGraph(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return isWorkflowGraph(raw) ? raw : null;
}

export function WorkflowDraftReadPage() {
  const { workspaceId, packId, workflowId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [isEditDirty, setEditDirty] = useState(false);
  const [isCreatingDraft, setCreatingDraft] = useState(false);
  const [pendingClose, setPendingClose] = useState<(() => void) | null>(null);
  const [existingDraftTarget, setExistingDraftTarget] = useState<{
    versionId: number;
    workflowId: number;
  } | null>(null);

  const wsId = parseRouteId(workspaceId);
  const pId = parseRouteId(packId);
  const vId = parseRouteId(search.get("versionId") ?? undefined);
  const wfId = workflowId ? parseRouteId(workflowId) : null;

  const enabled = wsId !== null && pId !== null && vId !== null && wfId !== null;

  const packQuery = usePackDetail(wsId ?? 0, pId ?? 0, {
    enabled: wsId !== null && pId !== null && vId !== null && wfId !== null,
  });
  const packDetail = packQuery.data;
  const packName = packDetail?.name ?? `PACK · ${pId ?? "?"}`;
  const selectedVersion = packDetail?.versions?.find((v) => v.versionId === vId);
  const versionNo = selectedVersion?.versionNo ?? vId ?? 0;
  const lifecycleStatus = selectedVersion?.lifecycleStatus ?? null;
  const workflowReturnTo = readWorkflowReturnTo(location.state);

  const query = useGetWorkflowDefinition({
    workspaceId: wsId ?? 0,
    packId: pId ?? 0,
    versionId: vId ?? 0,
    workflowId: wfId ?? 0,
    enabled,
  });

  const workflow = query.data;
  const graph = useMemo<WorkflowGraph | null>(
    () => parseGraphJson(workflow?.graphJson),
    [workflow?.graphJson],
  );
  const nodeCount = graph?.nodes?.length ?? 0;

  useEffect(() => {
    if (!isEditDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isEditDirty]);

  if (
    wsId === null ||
    pId === null ||
    vId === null ||
    (workflowId !== undefined && wfId === null)
  ) {
    return (
      <OstoneShell active="domain" crumbs={["도메인팩 관리"]}>
        <div role="alert" style={{ padding: "24px", color: "var(--danger)" }}>
          잘못된 URL 파라미터입니다.
        </div>
      </OstoneShell>
    );
  }

  const closeEditor = () => {
    setIsEditing(false);
    setEditDirty(false);
  };

  const guardEditorClose = (next: () => void) => {
    if (!isEditing || !isEditDirty) {
      next();
      return;
    }
    setPendingClose(() => next);
  };

  const navigateToWorkflow = (versionId: number, targetWorkflowId: number | null) => {
    navigate(
      domainPackSectionPath(wsId, pId, versionId, "workflows", targetWorkflowId ?? undefined),
      { replace: true },
    );
  };

  const findWorkflowIdByCode = async (versionId: number, workflowCode: string) => {
    const response = await listWorkflows(wsId, pId, versionId);
    const workflows = (unwrapApiResponse(response) ?? []) as WorkflowDefinitionSummary[];
    const target = workflows.find((entry) => entry.workflowCode === workflowCode);
    return typeof target?.id === "number" ? target.id : null;
  };

  const resolveExistingDraft = async (workflowCode: string) => {
    try {
      const refetched = await packQuery.refetch();
      const drafts = (refetched.data?.versions ?? []).filter(
        (version) => version.lifecycleStatus === "DRAFT" && version.versionId != null,
      );

      if (drafts.length !== 1 || drafts[0].versionId == null) {
        toast.error(
          "진행 중인 검토본을 확인할 수 없습니다. 도메인팩 화면에서 상태를 확인해 주세요.",
        );
        return;
      }

      const draftVersionId = drafts[0].versionId;
      const draftWorkflowId = await findWorkflowIdByCode(draftVersionId, workflowCode);

      if (draftWorkflowId == null) {
        toast.error("기존 검토본에서 같은 응대 흐름을 찾지 못했습니다.");
        return;
      }

      setExistingDraftTarget({
        versionId: draftVersionId,
        workflowId: draftWorkflowId,
      });
    } catch (error) {
      console.error("Failed to resolve existing workflow draft", error);
      toast.error(
        resolveWorkflowActionErrorMessage(
          error,
          "진행 중인 검토본을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        ),
      );
    }
  };

  const handleBackToList = () => {
    guardEditorClose(() => {
      closeEditor();
      navigate(workflowReturnTo ?? domainPackSectionPath(wsId, pId, vId, "workflows"), {
        replace: true,
      });
    });
  };

  const handleEdit = async () => {
    if (!workflow) return;
    if (lifecycleStatus !== "PUBLISHED") {
      setIsEditing(true);
      return;
    }

    if (!workflow.workflowCode) {
      toast.error("응대 코드를 확인할 수 없어 수정 검토본을 만들 수 없습니다.");
      return;
    }

    setCreatingDraft(true);
    try {
      const { draftVersionId } = await intentRevisionDraftApi.createRevisionDraft(wsId, pId, vId);
      await packQuery.refetch();
      const draftWorkflowId = await findWorkflowIdByCode(draftVersionId, workflow.workflowCode);
      if (draftWorkflowId === null) {
        toast.error("수정 검토본에서 같은 응대 흐름을 찾지 못했습니다.");
        navigateToWorkflow(draftVersionId, null);
        return;
      }
      navigateToWorkflow(draftVersionId, draftWorkflowId);
      setIsEditing(true);
      setEditDirty(false);
      toast.success("응대 흐름 수정 검토본이 생성되었습니다.");
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "DOMAIN_PACK_DRAFT_ALREADY_EXISTS") {
        await resolveExistingDraft(workflow.workflowCode);
        return;
      }
      toast.error(
        resolveWorkflowActionErrorMessage(error, "응대 흐름 수정 검토본 생성에 실패했습니다."),
      );
    } finally {
      setCreatingDraft(false);
    }
  };

  const confirmPendingClose = () => {
    const next = pendingClose;
    setPendingClose(null);
    closeEditor();
    next?.();
  };

  const confirmExistingDraftNavigation = () => {
    const target = existingDraftTarget;
    setExistingDraftTarget(null);
    if (!target) return;
    closeEditor();
    navigateToWorkflow(target.versionId, target.workflowId);
  };

  const crumbs: Crumb[] = buildDomainPackCrumbs({
    wsId: wsId!,
    pId: pId!,
    vId: vId!,
    packName,
    versionNo,
    section: { label: "응대 흐름", path: "workflows" },
    selectedLabel: workflow?.workflowCode ?? (wfId !== null ? `#${wfId}` : null),
  });

  let graphContent: ReactNode;
  if (isEditing && workflow) {
    graphContent = (
      <InlineWorkflowEditor
        workflow={workflow!}
        wsId={wsId!}
        packId={pId!}
        versionId={vId!}
        onClose={() => guardEditorClose(closeEditor)}
        onSaved={closeEditor}
        onDirtyChange={setEditDirty}
      />
    );
  } else if (graph) {
    graphContent = (
      <div data-testid="workflow-graph-viewer" style={{ width: "100%", height: "100%" }}>
        <GraphViewer graph={graph} />
      </div>
    );
  } else {
    graphContent = (
      <div data-testid="workflow-empty-graph" style={{ padding: "32px" }}>
        <EmptyState message="이 응대 흐름에는 아직 흐름도가 정의되어 있지 않습니다." />
      </div>
    );
  }

  return (
    <OstoneShell active="workflows" crumbs={crumbs}>
      <div className={styles.detailPage}>
        <div className={styles.detailHeader}>
          <div className={styles.titleGroup}>
            <div className={styles.titleStack}>
              <h2 data-testid="workflow-detail-title" className={styles.detailTitle}>
                {workflow?.name || (query.isLoading ? "응대 흐름 로드 중..." : "응대 흐름")}
              </h2>
              {workflow?.description && (
                <p className={styles.detailDescription}>{workflow.description}</p>
              )}
            </div>
            {workflow && lifecycleStatus && (
              <Pill tone="signal">{formatLifecycleStatus(lifecycleStatus)}</Pill>
            )}
            {workflow && isEditing && <Pill tone="ink">수정 중</Pill>}
            {workflow && <Mono className={styles.nodeCount}>노드 {nodeCount}개</Mono>}
          </div>

          <div className={styles.headerActions}>
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={handleBackToList}
              data-testid="list-back"
              className={`${styles.headerButton} ${styles.backAction}`}
            >
              <Icon name="chevron" size={14} />
              {workflowReturnTo ? "뒤로" : "목록"}
            </Button>
            {workflow && !isEditing && (
              <Button
                type="button"
                size="default"
                data-testid="edit-toggle"
                onClick={() => void handleEdit()}
                disabled={isCreatingDraft}
                className={`${styles.headerButton} ${styles.editAction}`}
              >
                <Icon name="edit" size={14} />
                {isCreatingDraft ? "초안 생성 중..." : "편집"}
              </Button>
            )}
          </div>
        </div>

        <div className={styles.canvasFrame} data-editing={isEditing ? "true" : "false"}>
          {!enabled && (
            <div data-testid="workflow-select-empty" className={styles.centerState}>
              좌측 사이드바에서 응대 흐름을 선택하세요.
            </div>
          )}

          {enabled && query.isLoading && (
            <div data-testid="workflow-loading" className={styles.loadingState}>
              <LoadingSpinner />
              <Mono className={styles.loadingText}>응대 흐름 로드 중...</Mono>
            </div>
          )}

          {enabled && query.isError && (
            <div data-testid="workflow-error" className={styles.errorState}>
              <ErrorState
                message="응대 흐름을 불러오지 못했습니다."
                onRetry={() => query.refetch()}
              />
            </div>
          )}

          {enabled && !query.isLoading && !query.isError && workflow && graphContent}
        </div>
      </div>
      <AlertDialog
        open={pendingClose !== null}
        onOpenChange={(open) => {
          if (!open) setPendingClose(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogTitle>변경 내역을 버릴까요?</AlertDialogTitle>
          <AlertDialogDescription>
            저장하지 않고 이동하면 현재 편집 중인 변경 내역이 버려집니다.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingClose(null)}>
              계속 편집
            </Button>
            <Button type="button" onClick={confirmPendingClose}>
              변경 내역 버리기
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={existingDraftTarget !== null}
        onOpenChange={(open) => {
          if (!open) setExistingDraftTarget(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogTitle>진행 중인 검토본이 있습니다</AlertDialogTitle>
          <AlertDialogDescription>
            새 검토본을 만들 수 없습니다. 기존 검토본에서 계속 편집하거나, 도메인팩 화면에서
            검토본을 적용 또는 폐기한 뒤 다시 시도하세요.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => setExistingDraftTarget(null)}>
              취소
            </Button>
            <Button type="button" onClick={confirmExistingDraftNavigation}>
              기존 검토본으로 이동
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </OstoneShell>
  );
}

function readWorkflowReturnTo(state: unknown): string | null {
  if (typeof state !== "object" || state === null) return null;
  const value = (state as { workflowReturnTo?: unknown }).workflowReturnTo;
  return typeof value === "string" && value.startsWith("/") ? value : null;
}

function formatLifecycleStatus(status: string): string {
  if (status === "PUBLISHED") return "운영 가능";
  if (status === "DRAFT") return "검토 중";
  return status;
}

function resolveWorkflowActionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError && error.message) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
