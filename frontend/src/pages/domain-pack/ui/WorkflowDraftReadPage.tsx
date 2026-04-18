import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../../shared/ui/layout/DashboardLayout';
import { WorkflowListPanel } from '../../../features/workflow-draft-read/ui/WorkflowListPanel';
import { WorkflowDetailPanel } from '../../../features/workflow-draft-read/ui/WorkflowDetailPanel';
import { parseRouteId } from '../../../shared/lib/parseRouteId';
import styles from './workflow-draft-read-page.module.css';

export function WorkflowDraftReadPage() {
  const { workspaceId, packId, versionId, workflowId } = useParams();
  const navigate = useNavigate();

  const wsId = parseRouteId(workspaceId);
  const pId = parseRouteId(packId);
  const vId = parseRouteId(versionId);
  const wfId = workflowId ? parseRouteId(workflowId) : null;

  if (wsId === null || pId === null || vId === null) {
    return (
      <DashboardLayout>
        <div className={styles.invalidParams}>잘못된 URL 파라미터입니다.</div>
      </DashboardLayout>
    );
  }

  const handleSelect = (id: number) => {
    navigate(`/workspaces/${wsId}/domain-packs/${pId}/versions/${vId}/workflows/${id}`);
  };

  return (
    <DashboardLayout>
      <div className={styles.twoPane}>
        <WorkflowListPanel
          wsId={wsId}
          packId={pId}
          versionId={vId}
          selectedId={wfId}
          onSelect={handleSelect}
        />
        <WorkflowDetailPanel
          wsId={wsId}
          packId={pId}
          versionId={vId}
          workflowId={wfId}
        />
      </div>
    </DashboardLayout>
  );
}
