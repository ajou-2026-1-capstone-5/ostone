import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRightIcon } from "lucide-react";
import { toast } from "sonner";
import { domainPackSectionPath } from "@/shared/lib/domainPackRoutes";
import {
  useIntentPreview,
  useSlotPreview,
  usePolicyPreview,
  useRiskPreview,
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

  const intentPreview = useIntentPreview(wsId, packId, versionId);
  const slotPreview = useSlotPreview(wsId, packId, versionId);
  const policyPreview = usePolicyPreview(wsId, packId, versionId);
  const riskPreview = useRiskPreview(wsId, packId, versionId);
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
    if (riskPreview.isError) toast.error("주의 사항 미리보기를 불러오지 못했습니다.");
  }, [riskPreview.isError]);

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
        previewItems={buildPreviewItems(intentPreview.data, "상담 유형")}
        isLoadingPreview={intentPreview.isLoading}
        emptyMessage={buildEmptyMessage("상담 유형", intentPreview.isError)}
        onPreviewItemClick={(id) =>
          navigate(domainPackSectionPath(wsId, packId, versionId, "intents", id))
        }
      />
      <CountCard
        label="확인 항목"
        count={slotCount}
        disabled={false}
        onNavigate={() => navigate(domainPackSectionPath(wsId, packId, versionId, "slots"))}
        previewItems={buildPreviewItems(slotPreview.data, "확인 항목")}
        isLoadingPreview={slotPreview.isLoading}
        emptyMessage={buildEmptyMessage("확인 항목", slotPreview.isError)}
        onPreviewItemClick={(id) =>
          navigate(domainPackSectionPath(wsId, packId, versionId, "slots", id))
        }
      />
      <CountCard
        label="응대 기준"
        count={policyCount}
        disabled={false}
        onNavigate={() => navigate(domainPackSectionPath(wsId, packId, versionId, "policies"))}
        previewItems={buildPreviewItems(policyPreview.data, "응대 기준")}
        isLoadingPreview={policyPreview.isLoading}
        emptyMessage={buildEmptyMessage("응대 기준", policyPreview.isError)}
        onPreviewItemClick={(id) =>
          navigate(domainPackSectionPath(wsId, packId, versionId, "policies", id))
        }
      />
      <CountCard
        label="주의 사항"
        count={riskCount}
        disabled={false}
        onNavigate={() => navigate(domainPackSectionPath(wsId, packId, versionId, "risks"))}
        previewItems={buildPreviewItems(riskPreview.data, "주의 사항")}
        isLoadingPreview={riskPreview.isLoading}
        emptyMessage={buildEmptyMessage("주의 사항", riskPreview.isError)}
        onPreviewItemClick={(id) =>
          navigate(domainPackSectionPath(wsId, packId, versionId, "risks", id))
        }
      />
      <CountCard
        label="워크플로우"
        count={workflowCount}
        disabled={false}
        onNavigate={() => navigate(domainPackSectionPath(wsId, packId, versionId, "workflows"))}
        previewItems={buildPreviewItems(workflowPreview.data, "워크플로우")}
        isLoadingPreview={workflowPreview.isLoading}
        emptyMessage={buildEmptyMessage("워크플로우", workflowPreview.isError)}
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
  previewItems?: Array<{ id: number; name: string }>;
  isLoadingPreview: boolean;
  emptyMessage: string;
  onPreviewItemClick?: (id: number) => void;
}

function CountCard({
  label,
  count,
  disabled,
  tooltip,
  onNavigate,
  previewItems,
  isLoadingPreview,
  emptyMessage,
  onPreviewItemClick,
}: CountCardProps) {
  return (
    <div
      className={`${styles.countCard} ${disabled ? styles.disabled : ""}`}
      title={disabled ? tooltip : undefined}
    >
      <div className={styles.cardHeader}>
        <span className={styles.cardLabel}>{label}</span>
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
      ) : disabled ? (
        <span className={styles.disabledNote}>준비 중</span>
      ) : (
        <span className={styles.emptyNote}>{emptyMessage}</span>
      )}
      {!disabled && onNavigate && (
        <button
          type="button"
          className={styles.cardActionButton}
          aria-label={`${label} 목록 보기`}
          onClick={onNavigate}
        >
          <span>목록 보기</span>
          <ChevronRightIcon aria-hidden />
        </button>
      )}
    </div>
  );
}

type PreviewSourceItem = Readonly<{
  id?: number | null;
  name?: string | null;
}>;

function buildPreviewItems(
  items: readonly PreviewSourceItem[] | undefined,
  fallbackLabel: string,
): Array<{ id: number; name: string }> | undefined {
  if (!items) return undefined;
  return items.flatMap((item, index) => {
    if (item.id == null) return [];
    return [
      {
        id: item.id,
        name: formatPreviewName(item.name, fallbackLabel, index),
      },
    ];
  });
}

function formatPreviewName(name: string | null | undefined, fallbackLabel: string, index: number) {
  const trimmed = name?.trim();
  return trimmed ? trimmed : `${fallbackLabel} #${index + 1}`;
}

function buildEmptyMessage(label: string, hasPreviewError: boolean): string {
  if (hasPreviewError) return "미리보기를 불러오지 못했습니다.";
  return `등록된 ${label} 초안이 없습니다.`;
}
