import type { DemoDecisionLogEntry } from '../model/chatWorkflow.types';
import type { WorkflowGraph } from '@/entities/workflow';

export function getNodeIdsByMessageId(
  messageId: string,
  logs: DemoDecisionLogEntry[],
  graph: WorkflowGraph,
): string[] {
  const matchedStates = new Set<string>();

  for (const log of logs) {
    if (log.messageId === messageId) {
      matchedStates.add(log.stateFrom);
      matchedStates.add(log.stateTo);
    }
  }

  return graph.nodes
    .filter((node) => matchedStates.has(node.id))
    .map((node) => node.id);
}

export function getMessageIdByNodeId(
  nodeId: string,
  logs: DemoDecisionLogEntry[],
  graph: WorkflowGraph,
): string | null {
  const nodeExists = graph.nodes.some((n) => n.id === nodeId);
  if (!nodeExists) return null;

  for (const log of logs) {
    if (log.stateFrom === nodeId || log.stateTo === nodeId) {
      return log.messageId;
    }
  }

  return null;
}
