import { type NodeProps } from '@xyflow/react';
import { BasicNode } from './BasicNode';

export function HandoffNode(props: NodeProps) {
  return <BasicNode {...props} variant="handoff" />;
}
