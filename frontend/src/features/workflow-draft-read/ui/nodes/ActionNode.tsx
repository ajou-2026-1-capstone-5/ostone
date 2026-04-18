import { Handle, Position, type NodeProps } from '@xyflow/react';
import styles from './nodes.module.css';

export function ActionNode({ data }: NodeProps) {
  return (
    <div className={`${styles.node} ${styles.action}`}>
      <Handle type="target" position={Position.Left} isConnectable={false} className={styles.handle} />
      <span className={styles.label}>{String(data.label)}</span>
      <Handle type="source" position={Position.Right} isConnectable={false} className={styles.handle} />
    </div>
  );
}
