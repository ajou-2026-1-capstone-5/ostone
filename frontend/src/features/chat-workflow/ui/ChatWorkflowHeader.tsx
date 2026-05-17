import type { DemoDomainPack } from '../model/chatWorkflow.types';
import styles from './chat-workflow-demo.module.css';

export interface ChatWorkflowHeaderProps {
  domainPack: DemoDomainPack | null;
}

export function ChatWorkflowHeader({ domainPack }: ChatWorkflowHeaderProps) {
  return (
    <header className={styles.header}>
      {domainPack && (
        <div className={styles.headerPack}>
          <span
            data-testid="header-domain-name"
            className={styles.headerName}
          >
            {domainPack.name}
          </span>
          <span
            data-testid="header-version"
            className={styles.pill}
          >
            v{domainPack.version}
          </span>
          {domainPack.status === 'PUBLISHED' && (
            <span
              data-testid="header-published"
              className={styles.pill}
            >
              Published
            </span>
          )}
        </div>
      )}

      <div className={styles.headerActions}>
        <button type="button" className={styles.secondaryButton}>
          Reset
        </button>
        <button type="button" className={styles.primaryButton}>
          Next Step
        </button>
      </div>
    </header>
  );
}
