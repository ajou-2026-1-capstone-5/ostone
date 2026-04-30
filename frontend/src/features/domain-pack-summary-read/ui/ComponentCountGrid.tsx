import { useNavigate } from 'react-router-dom';
import {
  useIntentPreview,
  useSlotPreview,
  usePolicyPreview,
  useRiskPreview,
  useWorkflowPreview,
} from '../model/usePreviewLists';
import styles from './ComponentCountGrid.module.css';

interface ComponentCountGridProps {
  wsId: number;
  packId: number;
  versionId: number;
  intentCount: number;
  slotCount: number;
  policyCount: number;
  riskCount: number;
  workflowCount: number;
}

export function ComponentCountGrid({
  wsId,
  packId,
  versionId,
  intentCount,
  slotCount,
  policyCount,
  riskCount,
  workflowCount,
}: ComponentCountGridProps) {
  const navigate = useNavigate();
  const basePath = `/workspaces/${wsId}/domain-packs/${packId}/versions/${versionId}`;

  const intentPreview = useIntentPreview(wsId, packId, versionId);
  const slotPreview = useSlotPreview(wsId, packId, versionId);
  const policyPreview = usePolicyPreview(wsId, packId, versionId);
  const riskPreview = useRiskPreview(wsId, packId, versionId);
  const workflowPreview = useWorkflowPreview(wsId, packId, versionId);

  return (
    <div className={styles.grid}>
      <CountCard
        label="Intent"
        count={intentCount}
        disabled
        tooltip="상세 화면 준비 중"
        previewNames={intentPreview.data?.map((i) => i.name)}
        isLoadingPreview={intentPreview.isLoading}
      />
      <CountCard
        label="Slot"
        count={slotCount}
        disabled
        tooltip="상세 화면 준비 중"
        previewNames={slotPreview.data?.map((s) => s.name)}
        isLoadingPreview={slotPreview.isLoading}
      />
      <CountCard
        label="Policy"
        count={policyCount}
        disabled
        tooltip="상세 화면 준비 중"
        previewNames={policyPreview.data?.map((p) => p.name)}
        isLoadingPreview={policyPreview.isLoading}
      />
      <CountCard
        label="Risk"
        count={riskCount}
        disabled
        tooltip="상세 화면 준비 중"
        previewNames={riskPreview.data?.map((r) => r.name)}
        isLoadingPreview={riskPreview.isLoading}
      />
      <CountCard
        label="Workflow"
        count={workflowCount}
        disabled={false}
        onNavigate={() => navigate(`${basePath}/workflows`)}
        previewNames={workflowPreview.data?.map((w) => w.name)}
        isLoadingPreview={workflowPreview.isLoading}
        onPreviewItemClick={(name) => {
          const found = workflowPreview.data?.find((w) => w.name === name);
          if (found) navigate(`${basePath}/workflows/${found.id}`);
        }}
      />
    </div>
  );
}

interface CountCardProps {
  label: string;
  count: number;
  disabled: boolean;
  tooltip?: string;
  onNavigate?: () => void;
  previewNames?: string[];
  isLoadingPreview: boolean;
  onPreviewItemClick?: (name: string) => void;
}

function CountCard({
  label,
  count,
  disabled,
  tooltip,
  onNavigate,
  previewNames,
  isLoadingPreview,
  onPreviewItemClick,
}: CountCardProps) {
  const handleClick = () => {
    if (!disabled && onNavigate) onNavigate();
  };

  return (
    <div
      className={`${styles.countCard} ${disabled ? styles.disabled : ''}`}
      title={disabled ? tooltip : undefined}
      onClick={handleClick}
      role={!disabled ? 'button' : undefined}
      tabIndex={!disabled ? 0 : undefined}
      onKeyDown={!disabled ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); }
      } : undefined}
    >
      <span className={styles.cardLabel}>{label}</span>
      <span className={styles.countNumber}>{count}</span>
      {isLoadingPreview ? (
        <div>
          {[0, 1, 2].map((i) => <div key={i} className={styles.skeletonLine} aria-hidden />)}
        </div>
      ) : previewNames && previewNames.length > 0 ? (
        <ul className={styles.previewList}>
          {previewNames.map((name) => (
            <li
              key={name}
              className={`${styles.previewItem} ${!disabled && onPreviewItemClick ? styles.clickable : ''}`}
              onClick={!disabled && onPreviewItemClick ? (e) => {
                e.stopPropagation();
                onPreviewItemClick(name);
              } : undefined}
            >
              {name}
            </li>
          ))}
        </ul>
      ) : disabled ? (
        <span className={styles.disabledNote}>준비 중</span>
      ) : null}
    </div>
  );
}
