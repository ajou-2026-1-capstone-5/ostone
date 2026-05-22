import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PolicyDetailPanel, PolicyListPanel } from "@/features/policy-draft-read/ui";
import { PolicyEditPanel } from "@/features/update-policy";
import {
  domainPackSectionPath,
  shouldReplaceDomainPackChildRoute,
} from "@/shared/lib/domainPackRoutes";
import { parseRouteId } from "@/shared/lib/parseRouteId";
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

  const handleBack = () => {
    setEditingPolicy(null);
    navigate(domainPackSectionPath(wsId, pId, vId, "policies"), { replace: true });
  };

  const hasSelection = selectedPolicyId !== null;
  const activeEditingPolicyId =
    editingPolicy?.routeKey === routeKey && editingPolicy.policyId === selectedPolicyId
      ? editingPolicy.policyId
      : null;

  return (
    <OstoneShell active="policy" crumbs={[`WS · ${wsId}`, "Domain Packs", `VER · ${vId}`]}>
      <div className={styles.pageWrapper}>
        <header className={styles.pageHeader}>
          <div className={styles.versionMeta}>
            <span className={styles.versionTitle}>Policy 초안 편집</span>
            <span className={styles.versionBadge}>READ / EDIT</span>
          </div>
        </header>
        {hasSelection && (
          <button type="button" className={styles.backButton} onClick={handleBack}>
            ← 목록
          </button>
        )}
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
