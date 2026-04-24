import { ArrowRightIcon, WorkflowIcon } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { parseRouteId } from "@/shared/lib/parseRouteId";
import { Button } from "@/shared/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/ui/empty";

import styles from "./workspace-workflows-page.module.css";

export function WorkspaceWorkflowsPage() {
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const parsedWorkspaceId = parseRouteId(workspaceId);

  if (parsedWorkspaceId === null) {
    return <Navigate to="/workspaces" replace />;
  }

  return (
    <Empty className={styles.emptyState}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <WorkflowIcon />
        </EmptyMedia>
        <EmptyTitle>아직 표시할 대표 워크플로우가 없습니다</EmptyTitle>
        <EmptyDescription>
          먼저 상담 로그를 업로드해 워크플로우 생성을 시작해 보세요.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className={styles.emptyContent}>
        {/* TODO: Replace this empty state once the backend exposes representative published version metadata. */}
        <p className={styles.emptyHint}>다음 단계로 상담 로그를 먼저 업로드할 수 있습니다.</p>
        <Button
          className={styles.emptyAction}
          variant="outline"
          size="sm"
          onClick={() => navigate(`/workspaces/${parsedWorkspaceId}/upload`)}
        >
          <span>Upload 열기</span>
          <ArrowRightIcon className={styles.emptyActionIcon} />
        </Button>
      </EmptyContent>
    </Empty>
  );
}
