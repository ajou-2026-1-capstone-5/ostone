import type { ReactNode } from "react";
import type { WorkspaceResponse } from "@/shared/api/generated/zod";

export interface ShellContext {
  setTopbarRight: (node: ReactNode | undefined) => void;
  setCrumbs: (crumbs: string[]) => void;
  workspace: WorkspaceResponse | null;
}
