import type { ReactNode } from "react";
import type { WorkspaceResponse } from "@/shared/api/generated/zod";
import type { Crumb } from "./Topbar";

export interface ShellContext {
  setTopbarRight: (node: ReactNode | undefined) => void;
  setCrumbs: (crumbs: Crumb[]) => void;
  workspace: WorkspaceResponse | null;
}
