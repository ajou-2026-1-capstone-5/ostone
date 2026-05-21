import { createElement, type ReactNode } from "react";
import {
  CircleCheck,
  GitBranch,
  Inbox,
  MessageSquare,
  UserPlus,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { GraphNodeType } from "../model/types";

const ICON_BY_KIND: Record<GraphNodeType, LucideIcon> = {
  START: Inbox,
  ACTION: Zap,
  DECISION: GitBranch,
  ANSWER: MessageSquare,
  HANDOFF: UserPlus,
  TERMINAL: CircleCheck,
};

const ICON_BY_HINT: Record<string, LucideIcon> = {
  Inbox,
  Zap,
  GitBranch,
  MessageSquare,
  UserPlus,
  CircleCheck,
};

export function resolveNodeIcon(kind: GraphNodeType, hint?: string): LucideIcon {
  if (hint && ICON_BY_HINT[hint]) return ICON_BY_HINT[hint];
  return ICON_BY_KIND[kind];
}

interface NodeIconOpts {
  size?: number;
  className?: string;
}

export function renderNodeIcon(
  kind: GraphNodeType,
  hint?: string,
  opts: NodeIconOpts = {},
): ReactNode {
  return createElement(resolveNodeIcon(kind, hint), {
    size: opts.size ?? 14,
    strokeWidth: 2.25,
    className: opts.className,
    "aria-hidden": true,
  });
}

export function readBadges(data: unknown): string[] | undefined {
  if (!data || typeof data !== "object") return undefined;
  const raw = (data as { badges?: unknown }).badges;
  if (!Array.isArray(raw)) return undefined;
  const cleaned = raw.filter((b): b is string => typeof b === "string" && b.length > 0);
  return cleaned.length > 0 ? cleaned : undefined;
}

export function readString(data: unknown, key: string): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const v = (data as Record<string, unknown>)[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}
