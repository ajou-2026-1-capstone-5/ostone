import { useEffect, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { ArrowUpRightIcon, FolderKanbanIcon, UploadIcon } from "lucide-react";
import { workspaceApi } from "@/entities/workspace";

import styles from "./workspace-shell.module.css";

const workspaceNameCache = new Map<number, string>();

interface WorkspaceShellProps {
  workspaceId: number;
  title: string;
  workspaceName?: string;
  children: ReactNode;
}

export function WorkspaceShell({
  workspaceId,
  title,
  workspaceName,
  children,
}: WorkspaceShellProps) {
  const [resolvedWorkspaceName, setResolvedWorkspaceName] = useState<string | null>(
    workspaceName ?? workspaceNameCache.get(workspaceId) ?? null,
  );

  useEffect(() => {
    if (workspaceName) {
      workspaceNameCache.set(workspaceId, workspaceName);
      setResolvedWorkspaceName(workspaceName);
      return;
    }

    const cachedName = workspaceNameCache.get(workspaceId);
    if (cachedName) {
      setResolvedWorkspaceName(cachedName);
      return;
    }

    let cancelled = false;

    void workspaceApi
      .get(workspaceId)
      .then((workspace) => {
        if (!cancelled) {
          workspaceNameCache.set(workspaceId, workspace.name);
          setResolvedWorkspaceName(workspace.name);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedWorkspaceName(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, workspaceName]);

  const getNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `${styles.sectionLink} ${isActive ? styles.sectionLinkActive : ""}`;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarPanel}>
          <div className={styles.workspaceIntro}>
            <p className={styles.kicker}>WORKSPACE</p>
            <div className={styles.workspaceNameRow}>
              <h2 className={styles.workspaceName}>{resolvedWorkspaceName || "Workspace"}</h2>
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
        <header className={styles.header}>
          <div className={styles.headingGroup}>
            <p className={styles.kicker}>WORKSPACE</p>
            <h1 className={styles.title}>{title}</h1>
          </div>
        </header>

        <div className={styles.content}>{children}</div>
      </section>
    </div>
  );
}
