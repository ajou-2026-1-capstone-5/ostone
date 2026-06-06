import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { SlotListPanel, SlotDetailPanel } from "../../../features/slot-draft-read/ui";
import {
  buildDomainPackCrumbs,
  domainPackSectionPath,
  shouldReplaceDomainPackChildRoute,
} from "../../../shared/lib/domainPackRoutes";
import { parseRouteId } from "../../../shared/lib/parseRouteId";
import { usePackDetail, VersionSafetyBanner } from "@/features/domain-pack-summary-read";
import { Pill } from "@/shared/ui/ostone/atoms";
import type { Crumb } from "@/shared/ui/ostone/chrome";
import { OstoneShell } from "@/widgets/ostone-shell";
import styles from "./slot-draft-read-page.module.css";

export function SlotDraftReadPage() {
  const { workspaceId, packId, slotId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();

  const wsId = parseRouteId(workspaceId);
  const pId = parseRouteId(packId);
  const vId = parseRouteId(search.get("versionId") ?? undefined);
  const sId = slotId ? parseRouteId(slotId) : null;

  const packDetail = usePackDetail(wsId ?? 0, pId ?? 0, {
    enabled:
      wsId !== null && pId !== null && vId !== null && (slotId === undefined || sId !== null),
  }).data;
  const packName = packDetail?.name ?? `PACK · ${pId ?? "?"}`;
  const versionNo = packDetail?.versions?.find((v) => v.versionId === vId)?.versionNo ?? vId ?? 0;

  if (wsId === null || pId === null || vId === null || (slotId !== undefined && sId === null)) {
    return (
      <OstoneShell active="domain" crumbs={["도메인팩 관리"]}>
        <div className={styles.invalidParams} role="alert">
          잘못된 URL 파라미터입니다.
        </div>
      </OstoneShell>
    );
  }

  const handleSelect = (id: number) => {
    const path = domainPackSectionPath(wsId, pId, vId, "slots", id);
    if (shouldReplaceDomainPackChildRoute(sId)) {
      navigate(path, { replace: true });
      return;
    }
    navigate(path);
  };

  const hasSelection = sId !== null;

  const crumbs: Crumb[] = buildDomainPackCrumbs({
    wsId,
    pId,
    vId,
    packName,
    versionNo,
    section: { label: "확인 항목", path: "slots" },
    selectedLabel: sId !== null ? `#${sId}` : null,
  });

  const topbarRight = <Pill tone="mute">읽기 전용</Pill>;

  return (
    <OstoneShell active="slot" crumbs={crumbs} topbarRight={topbarRight}>
      <div className={styles.pageWrapper}>
        <VersionSafetyBanner wsId={wsId} packId={pId} versionId={vId} />
        <div className={`${styles.twoPane} ${hasSelection ? styles.hasSelection : ""}`}>
          <div className={styles.listSlot}>
            <SlotListPanel
              wsId={wsId}
              packId={pId}
              versionId={vId}
              selectedId={sId}
              onSelect={handleSelect}
            />
          </div>
          <div className={styles.detailSlot}>
            <SlotDetailPanel wsId={wsId} packId={pId} versionId={vId} slotId={sId} />
          </div>
        </div>
      </div>
    </OstoneShell>
  );
}
