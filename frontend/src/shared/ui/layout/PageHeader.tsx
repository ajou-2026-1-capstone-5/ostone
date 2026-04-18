import styles from './page-header.module.css';

interface PageHeaderProps {
  wsId: number;
  pId: number;
  vId: number;
}

export function PageHeader({ wsId, pId, vId }: PageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      <nav className={styles.breadcrumb}>
        <span>워크스페이스 {wsId}</span>
        <span className={styles.breadcrumbSep}>/</span>
        <span>팩 {pId}</span>
        <span className={styles.breadcrumbSep}>/</span>
        <span>버전 {vId}</span>
      </nav>
      <span className={styles.versionBadge}>v{vId}</span>
    </header>
  );
}
