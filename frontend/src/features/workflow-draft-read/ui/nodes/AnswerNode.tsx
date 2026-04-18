import { type NodeProps } from '@xyflow/react';
import { BasicNode } from './BasicNode';

export function AnswerNode(props: NodeProps) {
  return <BasicNode {...props} variant="answer" />;
}
