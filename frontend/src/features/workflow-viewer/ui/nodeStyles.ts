import theme from "@/shared/styles/workflow-node-theme.module.css";
import type { GraphNodeStatus } from "@/entities/workflow";

export const STATUS_MAP: Record<GraphNodeStatus, string> = {
  IDLE: theme.statusIdle,
  ACTIVE: theme.statusActive,
  COMPLETED: theme.statusCompleted,
  FAILED: theme.statusFailed,
};

export {
  resolveNodeIcon,
  renderNodeIcon,
  readBadges,
  readString,
} from "@/entities/workflow/lib/nodeUtils";
