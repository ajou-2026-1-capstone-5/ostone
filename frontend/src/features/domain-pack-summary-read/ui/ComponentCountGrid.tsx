import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { domainPackSectionPath } from "@/shared/lib/domainPackRoutes";
import {
  useIntentPreview,
  useSlotPreview,
  usePolicyPreview,
  useWorkflowPreview,
} from "../model/usePreviewLists";
import styles from "./ComponentCountGrid.module.css";

interface ComponentCountGridProps {
  wsId: number;
  packId: number;
  versionId: number;
  intentCount: number;
  slotCount: number;
  policyCount: number;
  workflowCount: number;
}

export function ComponentCountGrid({
  wsId,
  packId,
  versionId,
  intentCount,
  slotCount,
  policyCount,
  workflowCount,
}: ComponentCountGridProps) {
  const navigate = useNavigate();

  const intentPreview = useIntentPreview(wsId, packId, versionId);
  const slotPreview = useSlotPreview(wsId, packId, versionId);
  const policyPreview = usePolicyPreview(wsId, packId, versionId);
  const workflowPreview = useWorkflowPreview(wsId, packId, versionId);

  useEffect(() => {
    if (intentPreview.isError) toast.error("Intent 미리보기 로드 실패");
  }, [intentPreview.isError]);

  useEffect(() => {
    if (slotPreview.isError) toast.error("Slot 미리보기 로드 실패");
  }, [slotPreview.isError]);

  useEffect(() => {
    if (policyPreview.isError) toast.error("Policy 미리보기 로드 실패");
  }, [policyPreview.isError]);

  useEffect(() => {
    if (workflowPreview.isError) toast.error("Workflow 미리보기 로드 실패");
  }, [workflowPreview.isError]);

  return (
    <div className={styles.grid}>
      <CountCard
        label="Intent"
        count={intentCount}
        disabled={false}
        onNavigate={() => navigate(domainPackSectionPath(wsId, packId, versionId, "intents"))}
        previewNames={intentPreview.data?.map((i) => i.name) as string[]}
        isLoadingPreview={intentPreview.isLoading}
      />
      <CountCard
        label="Slot"
        count={slotCount}
        disabled={false}
        onNavigate={() => navigate(domainPackSectionPath(wsId, packId, versionId, "slots"))}
        previewItems={
          slotPreview.data?.map((s) => ({ id: s.id, name: s.name })) as {
            id: number;
            name: string;
          }[]
        }
        isLoadingPreview={slotPreview.isLoading}
        onPreviewItemClick={(id) =>
          navigate(domainPackSectionPath(wsId, packId, versionId, "slots", id))
        }
      />
      <CountCard
        label="Policy"
        count={policyCount}
        disabled={false}
        onNavigate={() => navigate(domainPackSectionPath(wsId, packId, versionId, "policies"))}
        previewNames={policyPreview.data?.map((p) => p.name) as string[]}
        isLoadingPreview={policyPreview.isLoading}
      />
      <CountCard
        label="Workflow"
        count={workflowCount}
        disabled={false}
        onNavigate={() => navigate(domainPackSectionPath(wsId, packId, versionId, "workflows"))}
        previewItems={
          workflowPreview.data?.map((w) => ({ id: w.id, name: w.name })) as {
            id: number;
            name: string;
          }[]
        }
        isLoadingPreview={workflowPreview.isLoading}
        onPreviewItemClick={(id) =>
          navigate(domainPackSectionPath(wsId, packId, versionId, "workflows", id))
        }
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
  previewItems?: Array<{ id: number; name: string }>;
  isLoadingPreview: boolean;
  onPreviewItemClick?: (id: number) => void;
}

function CountCard({
  label,
  count,
  disabled,
  tooltip,
  onNavigate,
  previewNames,
  previewItems,
  isLoadingPreview,
  onPreviewItemClick,
}: CountCardProps) {
  const handleClick = () => {
    if (!disabled && onNavigate) onNavigate();
  };

  return (
    <div
      className={`${styles.countCard} ${disabled ? styles.disabled : ""}`}
      title={disabled ? tooltip : undefined}
      onClick={handleClick}
      role={!disabled ? "button" : undefined}
      tabIndex={!disabled ? 0 : undefined}
      onKeyDown={
        !disabled
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
    >
      <span className={styles.cardLabel}>{label}</span>
      <span className={styles.countNumber}>{count}</span>
      {isLoadingPreview ? (
        <div>
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.skeletonLine} aria-hidden />
          ))}
        </div>
      ) : previewItems && previewItems.length > 0 ? (
        <ul className={styles.previewList}>
          {previewItems.map((item) => (
            <li
              key={item.id}
              role={!disabled && onPreviewItemClick ? "button" : undefined}
              tabIndex={!disabled && onPreviewItemClick ? 0 : undefined}
              className={`${styles.previewItem} ${!disabled && onPreviewItemClick ? styles.clickable : ""}`}
              onClick={
                !disabled && onPreviewItemClick
                  ? (e) => {
                      e.stopPropagation();
                      onPreviewItemClick(item.id);
                    }
                  : undefined
              }
              onKeyDown={
                !disabled && onPreviewItemClick
                  ? (e) => {
                      e.stopPropagation();
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onPreviewItemClick(item.id);
                      }
                    }
                  : undefined
              }
            >
              {item.name}
            </li>
          ))}
        </ul>
      ) : previewNames && previewNames.length > 0 ? (
        <ul className={styles.previewList}>
          {previewNames.map((name, idx) => (
            <li key={`${name}-${idx}`} className={styles.previewItem}>
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
