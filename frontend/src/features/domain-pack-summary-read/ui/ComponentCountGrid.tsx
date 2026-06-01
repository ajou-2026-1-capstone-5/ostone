import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRightIcon } from "lucide-react";
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
    if (intentPreview.isError) toast.error("상담 유형 미리보기를 불러오지 못했습니다.");
  }, [intentPreview.isError]);

  useEffect(() => {
    if (slotPreview.isError) toast.error("확인 항목 미리보기를 불러오지 못했습니다.");
  }, [slotPreview.isError]);

  useEffect(() => {
    if (policyPreview.isError) toast.error("응대 기준 미리보기를 불러오지 못했습니다.");
  }, [policyPreview.isError]);

  useEffect(() => {
    if (workflowPreview.isError) toast.error("워크플로우 미리보기를 불러오지 못했습니다.");
  }, [workflowPreview.isError]);

  return (
    <div className={styles.grid}>
      <CountCard
        label="상담 유형"
        count={intentCount}
        disabled={false}
        onNavigate={() => navigate(domainPackSectionPath(wsId, packId, versionId, "intents"))}
        previewNames={intentPreview.data?.map((i) => i.name) as string[]}
        isLoadingPreview={intentPreview.isLoading}
      />
      <CountCard
        label="확인 항목"
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
        label="응대 기준"
        count={policyCount}
        disabled={false}
        onNavigate={() => navigate(domainPackSectionPath(wsId, packId, versionId, "policies"))}
        previewNames={policyPreview.data?.map((p) => p.name) as string[]}
        isLoadingPreview={policyPreview.isLoading}
      />
      <CountCard
        label="워크플로우"
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
  return (
    <div
      className={`${styles.countCard} ${disabled ? styles.disabled : ""}`}
      title={disabled ? tooltip : undefined}
    >
      <div className={styles.cardHeader}>
        <span className={styles.cardLabel}>{label}</span>
        {!disabled && onNavigate && (
          <button
            type="button"
            className={styles.cardArrowButton}
            aria-label={`${label} 상세 보기`}
            onClick={onNavigate}
          >
            <ChevronRightIcon aria-hidden />
          </button>
        )}
      </div>
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
