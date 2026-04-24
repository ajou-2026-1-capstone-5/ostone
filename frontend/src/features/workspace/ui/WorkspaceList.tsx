import { FolderSearchIcon, RefreshCcwIcon } from "lucide-react";

import type { WorkspaceResponse } from "@/entities/workspace";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/ui/empty";
import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/spinner";

import { WorkspaceCard } from "./WorkspaceCard";
import styles from "./workspace-list.module.css";

interface WorkspaceListProps {
  workspaces: WorkspaceResponse[];
  isLoading: boolean;
  error: string;
  onRetry: () => void;
  onCreate: () => void;
  onOpen: (workspace: WorkspaceResponse) => void;
  onEdit: (workspace: WorkspaceResponse) => void;
  onDelete: (workspace: WorkspaceResponse) => void;
}

export function WorkspaceList({
  workspaces,
  isLoading,
  error,
  onRetry,
  onCreate,
  onOpen,
  onEdit,
  onDelete,
}: WorkspaceListProps) {
  if (isLoading) {
    return (
      <div className={styles.statePanel} aria-live="polite">
        <Spinner className={styles.stateSpinner} />
        <p className={styles.stateText}>워크스페이스를 불러오는 중입니다.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.statePanel} role="alert">
        <p className={styles.stateTitle}>워크스페이스를 불러오지 못했습니다.</p>
        <p className={styles.stateText}>{error}</p>
        <Button variant="outline" onClick={onRetry}>
          <RefreshCcwIcon className="size-4" />
          다시 시도
        </Button>
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <Empty className={styles.emptyState}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderSearchIcon />
          </EmptyMedia>
          <EmptyTitle>워크스페이스가 없습니다</EmptyTitle>
          <EmptyDescription>
            첫 워크스페이스를 만들고 업로드, 리뷰, 워크플로우 탐색을 시작해보세요.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onCreate}>워크스페이스 생성</Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className={styles.workspaceGrid}>
      {workspaces.map((workspace) => (
        <WorkspaceCard
          key={workspace.id}
          workspace={workspace}
          onOpen={onOpen}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
