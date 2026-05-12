import type { WorkflowState } from "../model/chatWorkflow.types";

interface WorkflowGraphPanelProps {
  workflowState: WorkflowState;
}

export function WorkflowGraphPanel({ workflowState }: WorkflowGraphPanelProps) {
  return (
    <div className="p-4">
      <h3 className="mb-3 text-sm font-semibold">Workflow Graph</h3>
      {workflowState.currentNodeId ? (
        <div className="rounded-md bg-muted px-3 py-2 text-sm">
          <span className="text-xs text-muted-foreground">Current node:</span>{" "}
          <span className="font-medium">{workflowState.currentNodeId}</span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No active node</p>
      )}
    </div>
  );
}
