import { useMemo } from 'react';
import { ChatWorkflowHeader } from './ChatWorkflowHeader';
import GraphRenderer from '@/features/workflow-draft-read/ui/GraphRenderer';
import { ExecutionDetailPanel } from './ExecutionDetailPanel';
import { DecisionLogDrawer } from './DecisionLogDrawer';
import { adaptDemoWorkflow } from '../lib/workflowAdapter';
import { getNodeIdsByMessageId } from '../lib/messageNodeMapping';
import type {
  DemoWorkflow,
  DemoExecution,
  DemoDecisionLogEntry,
  DemoDomainPack,
} from '../model/chatWorkflow.types';

export interface SidePanelProps {
  workflow: DemoWorkflow;
  execution: DemoExecution | null;
  decisionLogs: DemoDecisionLogEntry[];
  selectedMessageId: string | null;
  domainPack: DemoDomainPack | null;
  onNodeSelect?: (nodeId: string) => void;
}

export function SidePanel({
  workflow,
  execution,
  decisionLogs,
  selectedMessageId,
  domainPack,
  onNodeSelect,
}: SidePanelProps) {
  const workflowGraph = useMemo(() => adaptDemoWorkflow(workflow), [workflow]);
  const selectedNodeIds = useMemo(
    () =>
      selectedMessageId
        ? getNodeIdsByMessageId(selectedMessageId, decisionLogs, workflowGraph)
        : [],
    [selectedMessageId, decisionLogs, workflowGraph],
  );

  return (
    <div
      data-testid="side-panel"
      className="flex h-full flex-col overflow-y-auto"
      style={{ minHeight: 0 }}
    >
      <div data-testid="side-panel-workflow-header">
        <ChatWorkflowHeader domainPack={domainPack} />
      </div>

      <div className="border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold">{workflow.name}</h3>
        <p className="mt-0.5 text-xs text-gray-500">{workflow.description}</p>
      </div>

      <div className="border-b border-gray-200" data-testid="graph-container">
        <GraphRenderer
          graph={workflowGraph}
          selectedNodeIds={selectedNodeIds}
          onNodeSelect={onNodeSelect}
        />
      </div>

      <div className="border-b border-gray-200">
        <ExecutionDetailPanel execution={execution} />
      </div>

      <div className="px-4 py-3">
        <DecisionLogDrawer entries={decisionLogs} selectedMessageId={selectedMessageId} />
      </div>
    </div>
  );
}
