import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { DOMAIN_PACK_DRAFT_ENTRY_NOT_FOUND, domainPackApi } from "@/entities/domain-pack";
import { mapWorkspaceActionError, workspaceApi, type WorkspaceResponse } from "@/entities/workspace";
import { ApiRequestError } from "@/shared/api";
import {
  ArchiveConfirmDialog,
  CreateWorkspaceDialog,
  EditWorkspaceDialog,
  WorkspaceList,
} from "@/features/workspace";
import { DashboardLayout } from "@/shared/ui/layout/DashboardLayout";
import { Button } from "@/shared/ui/button";

import styles from "./workspace-list-page.module.css";

export function WorkspaceListPage() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<WorkspaceResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<WorkspaceResponse | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<WorkspaceResponse | null>(null);
  const [policyDraftLoadingWorkspaceId, setPolicyDraftLoadingWorkspaceId] =
    useState<number | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await workspaceApi.list();
      setWorkspaces(data.filter((workspace) => workspace.status === "ACTIVE"));
    } catch (err) {
      setError(mapWorkspaceActionError(err) || "서버에 연결할 수 없습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWorkspaces();
  }, [fetchWorkspaces]);

  const handleOpenWorkspace = (workspace: WorkspaceResponse) => {
    navigate(`/workspaces/${workspace.id}/workflows`);
  };

  const handleOpenPolicyDraft = (workspace: WorkspaceResponse) => {
    if (policyDraftLoadingWorkspaceId !== null) {
      return;
    }

    setPolicyDraftLoadingWorkspaceId(workspace.id);
    void (async () => {
      try {
        const entry = await domainPackApi.getDraftEntry(workspace.id);
        navigate(
          `/workspaces/${workspace.id}/domain-packs/${entry.packId}/versions/${entry.versionId}/policies`,
        );
      } catch (err) {
        if (err instanceof ApiRequestError && err.code === DOMAIN_PACK_DRAFT_ENTRY_NOT_FOUND) {
          toast.error("수정 가능한 정책 초안이 없습니다.");
          return;
        }
        toast.error("정책 편집 화면으로 이동하지 못했습니다.");
      } finally {
        setPolicyDraftLoadingWorkspaceId(null);
      }
    })();
  };

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>WORKSPACES</p>
            <h1 className={styles.title}>팀별 워크플로우 운영 공간</h1>
            <p className={styles.description}>
              워크스페이스를 기준으로 업로드, 검토, 워크플로우 탐색 흐름을 묶어서 운영할 수 있습니다.
            </p>
          </div>
          <Button className={styles.createButton} onClick={() => setIsCreateOpen(true)}>
            워크스페이스 생성
          </Button>
        </section>

        <section className={styles.listSection}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Workspaces</h2>
            </div>
          </div>
          <WorkspaceList
            workspaces={workspaces}
            isLoading={isLoading}
            error={error}
            onRetry={() => void fetchWorkspaces()}
            onCreate={() => setIsCreateOpen(true)}
            onOpen={handleOpenWorkspace}
            onOpenPolicyDraft={handleOpenPolicyDraft}
            policyDraftLoadingWorkspaceId={policyDraftLoadingWorkspaceId}
            onEdit={(workspace) => setEditTarget(workspace)}
            onDelete={(workspace) => setArchiveTarget(workspace)}
          />
        </section>
      </div>

      <CreateWorkspaceDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={fetchWorkspaces}
      />
      <EditWorkspaceDialog
        workspace={editTarget}
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditTarget(null);
          }
        }}
        onSuccess={fetchWorkspaces}
      />
      <ArchiveConfirmDialog
        workspace={archiveTarget}
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setArchiveTarget(null);
          }
        }}
        onSuccess={fetchWorkspaces}
      />
    </DashboardLayout>
  );
}
