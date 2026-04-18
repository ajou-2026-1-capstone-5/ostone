import { Handle, Position, type NodeProps } from '@xyflow/react';
import styles from './nodes.module.css';

type Variant = 'start' | 'action' | 'answer' | 'handoff' | 'terminal';

interface BasicNodeProps extends NodeProps {
  variant: Variant;
}

export function BasicNode({ data, variant }: BasicNodeProps) {
  return (
    <div className={`${styles.node} ${styles[variant]}`}>
      {variant !== 'start' && (
        <Handle type="target" position={Position.Left} isConnectable={false} className={styles.handle} />
      )}
      <span className={styles.label}>{String(data.label)}</span>
      {variant !== 'terminal' && (
        <Handle type="source" position={Position.Right} isConnectable={false} className={styles.handle} />
      )}
    </div>
  );
}
