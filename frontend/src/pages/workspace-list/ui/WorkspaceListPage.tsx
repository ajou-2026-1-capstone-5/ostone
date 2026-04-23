import React from 'react';
import { DashboardLayout } from '../../../shared/ui/layout/DashboardLayout';
import styles from './workspace-list-page.module.css';

export const WorkspaceListPage: React.FC = () => {
  return (
    <DashboardLayout>
      <section className={styles.container} aria-labelledby="workspace-list-title">
        <p className={styles.label}>Workspace</p>
        <h1 id="workspace-list-title" className={styles.title}>
          워크스페이스
        </h1>
        <p className={styles.description}>
          로그인 이후 기본 진입점입니다. 워크스페이스 목록과 선택 흐름은 별도 작업에서 연결됩니다.
        </p>
      </section>
    </DashboardLayout>
  );
};
