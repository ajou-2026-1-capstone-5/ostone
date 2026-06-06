import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { usePackDetail, VersionSafetyBanner } from "@/features/domain-pack-summary-read";
import { RiskDetailPanel, RiskListPanel } from "@/features/risk-draft-read/ui";
import { RiskEditPanel } from "@/features/update-risk";
import {
  buildDomainPackCrumbs,
  domainPackSectionPath,
  shouldReplaceDomainPackChildRoute,
} from "@/shared/lib/domainPackRoutes";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { Pill } from "@/shared/ui/ostone/atoms";
import type { Crumb } from "@/shared/ui/ostone/chrome";
import { OstoneShell } from "@/widgets/ostone-shell";
import styles from "./risk-draft-read-page.module.css";

interface EditingRiskState {
  routeKey: string;
  riskId: number;
}

export function RiskDraftReadPage() {
  const { workspaceId, packId, riskId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [editingRisk, setEditingRisk] = useState<EditingRiskState | null>(null);
  const listSlotRef = useRef<HTMLDivElement>(null);
  const shouldFocusListRef = useRef(false);

  const wsId = parseRouteId(workspaceId);
  const pId = parseRouteId(packId);
  const vId = parseRouteId(search.get("versionId") ?? undefined);
  const selectedRiskId = riskId ? parseRouteId(riskId) : null;
  const hasInvalidRiskId = riskId !== undefined && selectedRiskId === null;
  const routeKey = `${wsId}:${pId}:${vId}:${selectedRiskId}`;

  const packDetail = usePackDetail(wsId ?? 0, pId ?? 0, {
    enabled: wsId !== null && pId !== null && vId !== null && !hasInvalidRiskId,
  }).data;
  const packName = packDetail?.name ?? `PACK · ${pId ?? "?"}`;
  const versionNo = packDetail?.versions?.find((v) => v.versionId === vId)?.versionNo ?? vId ?? 0;
  const hasSelection = selectedRiskId !== null;

  useEffect(() => {
    if (!shouldFocusListRef.current || hasSelection) return;
    listSlotRef.current?.focus();
    shouldFocusListRef.current = false;
  }, [hasSelection]);

  if (wsId === null || pId === null || vId === null || hasInvalidRiskId) {
    return (
      <OstoneShell active="domain" crumbs={["도메인팩 관리"]}>
        <div className={styles.invalidParams} role="alert">
          잘못된 URL 파라미터입니다.
        </div>
      </OstoneShell>
    );
  }

  const activeEditingRiskId =
    editingRisk?.routeKey === routeKey && editingRisk.riskId === selectedRiskId
      ? editingRisk.riskId
      : null;

  const handleBackToList = () => {
    setEditingRisk(null);
    shouldFocusListRef.current = true;
    navigate(domainPackSectionPath(wsId, pId, vId, "risks"), { replace: true });
  };

  const crumbs: Crumb[] = buildDomainPackCrumbs({
    wsId,
    pId,
    vId,
    packName,
    versionNo,
    section: { label: "주의 사항", path: "risks" },
    selectedLabel: selectedRiskId !== null ? `#${selectedRiskId}` : null,
  });

  const topbarRight = <Pill tone="mute">조회/수정</Pill>;

  return (
    <OstoneShell active="risk" crumbs={crumbs} topbarRight={topbarRight}>
      <div className={styles.pageWrapper}>
        <VersionSafetyBanner wsId={wsId} packId={pId} versionId={vId} />
        {hasSelection && (
          <button type="button" className={styles.backButton} onClick={handleBackToList}>
            목록
          </button>
        )}
        <div className={`${styles.twoPane} ${hasSelection ? styles.hasSelection : ""}`}>
          <div
            ref={listSlotRef}
            className={styles.listSlot}
            tabIndex={-1}
            aria-label="주의 사항 목록 영역"
          >
            <RiskListPanel
              workspaceId={wsId}
              packId={pId}
              versionId={vId}
              selectedId={selectedRiskId}
              onSelect={(id) => {
                setEditingRisk(null);
                const path = domainPackSectionPath(wsId, pId, vId, "risks", id);
                if (shouldReplaceDomainPackChildRoute(selectedRiskId)) {
                  navigate(path, { replace: true });
                  return;
                }
                navigate(path);
              }}
            />
          </div>
          <div className={styles.detailSlot}>
            {activeEditingRiskId === null ? (
              <RiskDetailPanel
                workspaceId={wsId}
                packId={pId}
                versionId={vId}
                riskId={selectedRiskId}
                onEdit={(id) => setEditingRisk({ routeKey, riskId: id })}
              />
            ) : (
              <RiskEditPanel
                workspaceId={wsId}
                packId={pId}
                versionId={vId}
                riskId={activeEditingRiskId}
                onClose={() => setEditingRisk(null)}
              />
            )}
          </div>
        </div>
      </div>
    </OstoneShell>
  );
}
