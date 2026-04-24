import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { mapWorkspaceActionError, workspaceApi, type WorkspaceResponse } from "@/entities/workspace";
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
