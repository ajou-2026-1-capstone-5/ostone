import { type NodeProps } from '@xyflow/react';
import { BasicNode } from './BasicNode';

export function StartNode(props: NodeProps) {
  return <BasicNode {...props} variant="start" />;
}
