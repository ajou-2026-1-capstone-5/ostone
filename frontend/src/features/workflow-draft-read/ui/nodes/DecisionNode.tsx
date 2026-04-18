import { Handle, Position, type NodeProps } from '@xyflow/react';
import styles from './nodes.module.css';

export function DecisionNode({ data }: NodeProps) {
  return (
    <div className={`${styles.node} ${styles.decisionWrapper}`}>
      <Handle type="target" position={Position.Left} isConnectable={false} className={styles.handle} />
      <div className={styles.diamond}>
        <span className={styles.diamondLabel}>{String(data.label)}</span>
      </div>
      <Handle type="source" position={Position.Right} isConnectable={false} className={styles.handle} />
    </div>
  );
}
