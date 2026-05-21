import { useStore } from "@xyflow/react";
import type { HandleSide } from "../model/types";

const VALID_SIDES = new Set<HandleSide>(["left", "right", "top", "bottom"]);

export function useConnectedSides(nodeId: string): {
  sources: HandleSide[];
  targets: HandleSide[];
} {
  return useStore(
    (s) => {
      const sources = new Set<HandleSide>();
      const targets = new Set<HandleSide>();
      for (const edge of s.edges) {
        if (
          edge.source === nodeId &&
          edge.sourceHandle &&
          VALID_SIDES.has(edge.sourceHandle as HandleSide)
        ) {
          sources.add(edge.sourceHandle as HandleSide);
        }
        if (
          edge.target === nodeId &&
          edge.targetHandle &&
          VALID_SIDES.has(edge.targetHandle as HandleSide)
        ) {
          targets.add(edge.targetHandle as HandleSide);
        }
      }
      return { sources: Array.from(sources), targets: Array.from(targets) };
    },
    (a, b) =>
      a.sources.length === b.sources.length &&
      a.targets.length === b.targets.length &&
      a.sources.every((s) => b.sources.includes(s)) &&
      a.targets.every((t) => b.targets.includes(t)),
  );
}
