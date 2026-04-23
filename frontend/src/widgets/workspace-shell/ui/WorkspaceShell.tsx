import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { ArrowUpRightIcon, FolderKanbanIcon, UploadIcon } from "lucide-react";

import styles from "./workspace-shell.module.css";

interface WorkspaceShellProps {
  workspaceId: number;
  workspaceName?: string;
  children: ReactNode;
}

export function WorkspaceShell({
  workspaceId,
  workspaceName,
  children,
}: WorkspaceShellProps) {
  const getNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `${styles.sectionLink} ${isActive ? styles.sectionLinkActive : ""}`;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarPanel}>
          <div className={styles.workspaceIntro}>
            <p className={styles.kicker}>WORKSPACE</p>
            <div className={styles.workspaceNameRow}>
              <h2 className={styles.workspaceName}>{workspaceName || "Workspace"}</h2>
              <ArrowUpRightIcon className={styles.workspaceArrow} />
            </div>
          </div>

          <nav className={styles.sectionNav} aria-label="워크스페이스 섹션">
            <NavLink to={`/workspaces/${workspaceId}/workflows`} className={getNavLinkClass}>
              <FolderKanbanIcon className="size-4" />
              Workflows
            </NavLink>
            <NavLink to={`/workspaces/${workspaceId}/upload`} className={getNavLinkClass}>
              <UploadIcon className="size-4" />
              Upload
            </NavLink>
          </nav>
        </div>
      </aside>

      <section className={styles.main}>
        <div className={styles.content}>{children}</div>
      </section>
    </div>
  );
}
