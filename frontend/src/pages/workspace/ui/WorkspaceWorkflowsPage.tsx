import { ArrowRightIcon, WorkflowIcon } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { parseRouteId } from "@/shared/lib/parseRouteId";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/ui/empty";

import styles from "./workspace-workflows-page.module.css";

export function WorkspaceWorkflowsPage() {
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const parsedWorkspaceId = parseRouteId(workspaceId);

  if (parsedWorkspaceId === null) {
    return <div className={styles.invalidState} role="alert">잘못된 워크스페이스 주소입니다.</div>;
  }

  return (
    <Empty className={styles.emptyState}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <WorkflowIcon />
        </EmptyMedia>
        <EmptyTitle>대표 workflow version을 확인할 수 없습니다</EmptyTitle>
        <EmptyDescription>
          현재 backend API에는 workspace의 published domain pack version 목록을 조회하는 기존
          endpoint가 없어, publishedAt 기준 최신 대표 version을 해소할 수 없습니다.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className={styles.emptyContent}>
        <p className={styles.emptyHint}>다음 단계로 상담 로그를 먼저 업로드할 수 있습니다.</p>
        <button
          type="button"
          className={styles.emptyAction}
          onClick={() => navigate(`/workspaces/${parsedWorkspaceId}/upload`)}
        >
          <span>Upload 열기</span>
          <ArrowRightIcon className={styles.emptyActionIcon} />
        </button>
      </EmptyContent>
    </Empty>
  );
}
