import type { WorkflowDetail } from "@/entities/workflow";
import { WorkflowEditForm } from "./WorkflowEditForm";

interface InlineWorkflowEditorProps {
  workflow: WorkflowDetail;
  wsId: number;
  packId: number;
  versionId: number;
  onClose: () => void;
}

/**
 * Inline workflow editor — same form as the legacy Sheet wrapper but mounted
 * directly inside the workflow detail page (no modal/sheet chrome).
 */
export function InlineWorkflowEditor({
  workflow,
  wsId,
  packId,
  versionId,
  onClose,
}: InlineWorkflowEditorProps) {
  return (
    <div
      data-testid="inline-workflow-editor"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--paper-2)",
        border: "1px solid var(--line-2)",
        borderRadius: "var(--r-2)",
      }}
    >
      <WorkflowEditForm
        workflow={workflow}
        wsId={wsId}
        packId={packId}
        versionId={versionId}
        onClose={onClose}
      />
    </div>
  );
}
