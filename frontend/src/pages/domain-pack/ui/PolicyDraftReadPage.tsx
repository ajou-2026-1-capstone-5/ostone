import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { usePackDetail } from "@/features/domain-pack-summary-read";
import { PolicyDetailPanel, PolicyListPanel } from "@/features/policy-draft-read/ui";
import { PolicyEditPanel } from "@/features/update-policy";
import {
  buildDomainPackCrumbs,
  domainPackSectionPath,
  shouldReplaceDomainPackChildRoute,
} from "@/shared/lib/domainPackRoutes";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { Pill } from "@/shared/ui/ostone/atoms";
import type { Crumb } from "@/shared/ui/ostone/chrome";
import { OstoneShell } from "@/widgets/ostone-shell";
import styles from "./policy-draft-read-page.module.css";

interface EditingPolicyState {
  routeKey: string;
  policyId: number;
}

export function PolicyDraftReadPage() {
  const { workspaceId, packId, policyId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [editingPolicy, setEditingPolicy] = useState<EditingPolicyState | null>(null);

  const wsId = parseRouteId(workspaceId);
  const pId = parseRouteId(packId);
  const vId = parseRouteId(search.get("versionId") ?? undefined);
  const selectedPolicyId = policyId ? parseRouteId(policyId) : null;
  const hasInvalidPolicyId = policyId !== undefined && selectedPolicyId === null;
  const routeKey = `${wsId}:${pId}:${vId}:${selectedPolicyId}`;

  const packDetail = usePackDetail(wsId ?? 0, pId ?? 0, {
    enabled: wsId !== null && pId !== null && vId !== null && !hasInvalidPolicyId,
  }).data;
  const packName = packDetail?.name ?? `PACK · ${pId ?? "?"}`;
  const versionNo = packDetail?.versions?.find((v) => v.versionId === vId)?.versionNo ?? vId ?? 0;

  if (wsId === null || pId === null || vId === null || hasInvalidPolicyId) {
    return (
      <OstoneShell active="domain" crumbs={["Domain Packs"]}>
        <div className={styles.invalidParams} role="alert">
          잘못된 URL 파라미터입니다.
        </div>
      </OstoneShell>
    );
  }

  const handleSelect = (id: number) => {
    setEditingPolicy(null);
    const path = domainPackSectionPath(wsId, pId, vId, "policies", id);
    if (shouldReplaceDomainPackChildRoute(selectedPolicyId)) {
      navigate(path, { replace: true });
      return;
    }
    navigate(path);
  };

  const hasSelection = selectedPolicyId !== null;
  const activeEditingPolicyId =
    editingPolicy?.routeKey === routeKey && editingPolicy.policyId === selectedPolicyId
      ? editingPolicy.policyId
      : null;

  const crumbs: Crumb[] = buildDomainPackCrumbs({
    wsId,
    pId,
    vId,
    packName,
    versionNo,
    section: { label: "POLICIES", path: "policies" },
    selectedLabel: selectedPolicyId !== null ? `#${selectedPolicyId}` : null,
  });

  const topbarRight = <Pill tone="mute">READ / EDIT</Pill>;

  return (
    <OstoneShell active="policy" crumbs={crumbs} topbarRight={topbarRight}>
      <div className={styles.pageWrapper}>
        <div className={`${styles.twoPane} ${hasSelection ? styles.hasSelection : ""}`}>
          <div className={styles.listSlot}>
            <PolicyListPanel
              workspaceId={wsId}
              packId={pId}
              versionId={vId}
              selectedId={selectedPolicyId}
              onSelect={handleSelect}
            />
          </div>
          <div className={styles.detailSlot}>
            {activeEditingPolicyId === null ? (
              <PolicyDetailPanel
                workspaceId={wsId}
                packId={pId}
                versionId={vId}
                policyId={selectedPolicyId}
                onEdit={(id) => setEditingPolicy({ routeKey, policyId: id })}
              />
            ) : (
              <PolicyEditPanel
                workspaceId={wsId}
                packId={pId}
                versionId={vId}
                policyId={activeEditingPolicyId}
                onClose={() => setEditingPolicy(null)}
              />
            )}
          </div>
        </div>
      </div>
    </OstoneShell>
  );
}
