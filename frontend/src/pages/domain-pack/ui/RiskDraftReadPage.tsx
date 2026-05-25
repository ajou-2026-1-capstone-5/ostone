import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { usePackDetail } from "@/features/domain-pack-summary-read";
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

  const wsId = parseRouteId(workspaceId);
  const pId = parseRouteId(packId);
  const vId = parseRouteId(search.get("versionId") ?? undefined);
  const selectedRiskId = riskId ? parseRouteId(riskId) : null;
  const hasInvalidRiskId = riskId !== undefined && selectedRiskId === null;
  const routeKey = `${wsId}:${pId}:${vId}:${selectedRiskId}`;

  const packDetail = usePackDetail(wsId ?? 0, pId ?? 0, {
    enabled: wsId !== null && pId !== null,
  }).data;
  const packName = packDetail?.name ?? `PACK · ${pId ?? "?"}`;
  const versionNo =
    packDetail?.versions?.find((v) => v.versionId === vId)?.versionNo ?? vId ?? 0;

  if (wsId === null || pId === null || vId === null || hasInvalidRiskId) {
    return (
      <OstoneShell active="domain" crumbs={["Domain Packs"]}>
        <div className={styles.invalidParams} role="alert">
          잘못된 URL 파라미터입니다.
        </div>
      </OstoneShell>
    );
  }

  const hasSelection = selectedRiskId !== null;
  const activeEditingRiskId =
    editingRisk?.routeKey === routeKey && editingRisk.riskId === selectedRiskId
      ? editingRisk.riskId
      : null;

  const crumbs: Crumb[] = buildDomainPackCrumbs({
    wsId,
    pId,
    vId,
    packName,
    versionNo,
    section: { label: "RISKS", path: "risks" },
    selectedLabel: selectedRiskId !== null ? `#${selectedRiskId}` : null,
  });

  const topbarRight = <Pill tone="mute">READ / EDIT</Pill>;

  return (
    <OstoneShell active="risk" crumbs={crumbs} topbarRight={topbarRight}>
      <div className={styles.pageWrapper}>
        <div className={`${styles.twoPane} ${hasSelection ? styles.hasSelection : ""}`}>
          <div className={styles.listSlot}>
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
