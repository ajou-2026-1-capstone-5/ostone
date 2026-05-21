import { useEffect } from "react";
import { useNodesInitialized, useReactFlow } from "@xyflow/react";
import { FIT_OPTIONS } from "./fitOptions";

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
