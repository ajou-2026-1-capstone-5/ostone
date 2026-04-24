import { ArrowRightIcon, PencilIcon, Trash2Icon } from "lucide-react";

import { normalizeWorkspaceMemberRole, type WorkspaceResponse } from "@/entities/workspace";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/shared/ui/card";

import styles from "./workspace-list.module.css";

interface WorkspaceCardProps {
  workspace: WorkspaceResponse;
  onOpen: (workspace: WorkspaceResponse) => void;
  onEdit: (workspace: WorkspaceResponse) => void;
  onDelete: (workspace: WorkspaceResponse) => void;
}

const EDITABLE_ROLES = new Set(["OWNER", "ADMIN"]);

export function WorkspaceCard({
  workspace,
  onOpen,
  onEdit,
  onDelete,
}: WorkspaceCardProps) {
  const handleOpen = () => onOpen(workspace);

  const normalizedRole = normalizeWorkspaceMemberRole(workspace.myRole);
  const canEdit = normalizedRole !== null && EDITABLE_ROLES.has(normalizedRole);
  const canDelete = normalizedRole === "OWNER";

  return (
    <Card className={styles.workspaceCard}>
      <CardHeader className={styles.workspaceCardHeader}>
        <div className={styles.titleBlock}>
          <p className={styles.eyebrow}>WORKSPACE</p>
          <CardTitle className={styles.workspaceName}>{workspace.name}</CardTitle>
          <p className={styles.workspaceDescription}>
            {workspace.description || "상담 로그 업로드, 검토, 워크플로우 탐색을 이 공간에서 이어갈 수 있습니다."}
          </p>
        </div>
      </CardHeader>
      <CardContent className={styles.workspaceCardContent} />
      <CardFooter className={styles.workspaceCardFooter}>
        <Button variant="ghost" className={styles.openButton} onClick={handleOpen}>
          Open Workspace
          <ArrowRightIcon className="size-4" />
        </Button>
        <div className={styles.cardActions}>
          {canEdit && (
            <Button variant="outline" size="sm" className={styles.actionButton} onClick={() => onEdit(workspace)}>
              <PencilIcon className="size-4" />
              수정
            </Button>
          )}
          {canDelete && (
            <Button variant="outline" size="sm" className={styles.actionButton} onClick={() => onDelete(workspace)}>
              <Trash2Icon className="size-4" />
              삭제
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
