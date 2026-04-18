import { type NodeProps } from '@xyflow/react';
import { BasicNode } from './BasicNode';

export function ActionNode(props: NodeProps) {
  return <BasicNode {...props} variant="action" />;
}
