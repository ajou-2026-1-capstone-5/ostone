import { useEffect } from "react";
import { useNodesInitialized, useReactFlow } from "@xyflow/react";

export const FIT_OPTIONS = { padding: 0.08, maxZoom: 1.4, duration: 0 } as const;

export function FitOnInit() {
  const initialized = useNodesInitialized();
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (!initialized) return;
    fitView(FIT_OPTIONS);
    const raf = requestAnimationFrame(() => fitView(FIT_OPTIONS));
    return () => cancelAnimationFrame(raf);
  }, [initialized, fitView]);
  return null;
}
