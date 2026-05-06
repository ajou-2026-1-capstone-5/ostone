import { useNavigate, useParams } from "react-router-dom";
import { IntentDetailPanel, IntentTreePanel } from "@/features/intent-draft-read/ui";
import { IntentDetailWithApproval } from "@/features/approve-intent";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { OstoneShell } from "@/widgets/ostone-shell";
import { Mono } from "@/shared/ui/ostone/atoms";
import styles from "./intent-draft-read-page.module.css";

export function IntentDraftReadPage() {
  const { workspaceId, packId, versionId, intentId } = useParams();
  const navigate = useNavigate();

  const wsId = parseRouteId(workspaceId);
  const pId = parseRouteId(packId);
  const vId = parseRouteId(versionId);
  const iId = intentId ? parseRouteId(intentId) : null;

  if (wsId === null || pId === null || vId === null || (intentId !== undefined && iId === null)) {
    return (
      <OstoneShell active="domain" crumbs={[]}>
        <div className={styles.invalidParams} role="alert">
          잘못된 URL 파라미터입니다.
        </div>
      </OstoneShell>
    );
  }

  const handleSelect = (id: number) => {
    navigate(`/workspaces/${wsId}/domain-packs/${pId}/versions/${vId}/intents/${id}`);
  };

  const handleBack = () => {
    navigate(`/workspaces/${wsId}/domain-packs/${pId}/versions/${vId}/intents`);
  };

  const hasSelection = iId !== null;

  return (
    <OstoneShell active="domain" crumbs={[`PACK · ${pId}`, `Version · ${vId}`]}>
      <div className={styles.pageWrapper}>
        <header className={styles.pageHeader}>
          <nav className={styles.breadcrumb} aria-label="경로">
            <Mono>WS · {wsId}</Mono>
            <span className={styles.breadcrumbSeparator}>/</span>
            <Mono>PACK · {pId}</Mono>
            <span className={styles.breadcrumbSeparator}>/</span>
            <Mono>VER · {vId}</Mono>
          </nav>
          <div className={styles.versionMeta}>
            <span className={styles.versionTitle}>Intent 초안 조회</span>
            <span className={styles.versionBadge}>READ ONLY</span>
          </div>
        </header>
        {hasSelection && (
          <button type="button" className={styles.backButton} onClick={handleBack}>
            ← 목록
          </button>
        )}
        <div className={`${styles.twoPane} ${hasSelection ? styles.hasSelection : ""}`}>
          <div className={styles.listSlot}>
            <IntentTreePanel
              wsId={wsId}
              packId={pId}
              versionId={vId}
              selectedId={iId}
              onSelect={handleSelect}
            />
          </div>
          <div className={styles.detailSlot}>
            {iId !== null ? (
              <IntentDetailWithApproval key={iId} wsId={wsId} pId={pId} vId={vId} iId={iId} />
            ) : (
              <IntentDetailPanel wsId={wsId} packId={pId} versionId={vId} intentId={null} />
            )}
          </div>
        </div>
      </div>
    </OstoneShell>
  );
}