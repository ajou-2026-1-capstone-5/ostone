import { useState } from "react";
import { CheckIcon, ChevronDownIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react";

import type { WorkspaceResponse } from "@/shared/api/generated/zod";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

import styles from "./workspace-switcher.module.css";

interface WorkspaceSwitcherProps {
  workspaces: WorkspaceResponse[];
  currentWorkspaceId: number | null;
  onSwitch: (workspaceId: number) => void;
  onCreate: () => void;
  onEdit: (workspace: WorkspaceResponse) => void;
  onArchive: (workspace: WorkspaceResponse) => void;
}

export function WorkspaceSwitcher({
  workspaces,
  currentWorkspaceId,
  onSwitch,
  onCreate,
  onEdit,
  onArchive,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);

  const activeWorkspaces = workspaces.filter((w) => w.status === "ACTIVE");
  const archivedWorkspaces = workspaces.filter((w) => w.status === "ARCHIVED");
  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);

  const handleSwitch = (workspaceId: number) => {
    onSwitch(workspaceId);
    setOpen(false);
  };

  const handleCreate = () => {
    onCreate();
    setOpen(false);
  };

  const handleEdit = (workspace: WorkspaceResponse) => {
    onEdit(workspace);
    setOpen(false);
  };

  const handleArchive = (workspace: WorkspaceResponse) => {
    onArchive(workspace);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={`${styles.trigger}${open ? ` ${styles.triggerActive}` : ""}`}
          aria-label="워크스페이스 선택"
        >
          <span className={styles.triggerLabel}>
            {currentWorkspace?.name ?? "워크스페이스 선택"}
          </span>
          <ChevronDownIcon className={styles.chevron} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className={styles.dropdownContent} align="start">
        {activeWorkspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            className={styles.workspaceItem}
            onClick={() => workspace.id != null && handleSwitch(workspace.id!)}
          >
            <span className={styles.workspaceName}>{workspace.name ?? ""}</span>
            <span className={styles.workspaceItemRight}>
              {workspace.id === currentWorkspaceId && (
                <CheckIcon className={styles.currentBadge} />
              )}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger
                  className={styles.actionButton}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontalIcon className="size-4" />
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => handleEdit(workspace)}>
                    수정
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleArchive(workspace)}>
                    삭제
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </span>
          </DropdownMenuItem>
        ))}
        {archivedWorkspaces.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className={styles.archivedLabel}>
              보관됨
            </DropdownMenuLabel>
            {archivedWorkspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                className={styles.workspaceItemArchived}
                onClick={() => workspace.id != null && handleSwitch(workspace.id!)}
              >
                <span className={styles.workspaceName}>{workspace.name ?? ""}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className={styles.createItem} onClick={handleCreate}>
          <PlusIcon className={styles.createIcon} />
          <span>+ 새 워크스페이스</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
