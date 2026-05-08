import type { ReactNode } from "react";
import type { WorkspaceResponse } from "@/entities/workspace";

export interface ShellContext {
  setTopbarRight: (node: ReactNode | undefined) => void;
  setCrumbs: (crumbs: string[]) => void;
  workspace: WorkspaceResponse | null;
}
