// WorkflowGraphPanel is deprecated — replaced by StateMachineGraph + SidePanel
// File kept to avoid git-rm conflicts; import uses inline type for build compatibility

interface WorkflowGraphPanelProps {
  workflowState: { currentNodeId: string | null; status: string; context: Record<string, unknown> };
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
