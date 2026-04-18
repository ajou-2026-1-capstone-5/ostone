import { type NodeProps } from '@xyflow/react';
import { BasicNode } from './BasicNode';

export function TerminalNode(props: NodeProps) {
  return <BasicNode {...props} variant="terminal" />;
}
