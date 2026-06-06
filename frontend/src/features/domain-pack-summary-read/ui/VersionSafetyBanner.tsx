import type { DomainPackDetail, DomainPackVersionDetail } from "@/entities/domain-pack";
import { Pill, type PillTone } from "@/shared/ui/ostone/atoms";
import { usePackDetail, useVersionDetail } from "../model/usePackDetail";
import {
  buildVersionSafetyState,
  type VersionSafetyCounts,
  type VersionSafetyTone,
} from "../model/buildVersionSafetyState";
import styles from "./VersionSafetyBanner.module.css";

interface VersionSafetyBannerProps {
  wsId: number;
  packId: number;
  versionId: number | null;
  /** 배포/적용 진행 중인 버전 id. summary 화면에서 mutation 상태를 전달하면 배너가
   *  "배포를 진행…"/"적용하고 있습니다" 사유를 보여준다. 하위 화면은 생략(null). */
  deployingVersionId?: number | null;
  applyingVersionId?: number | null;
}

const TONE_TO_PILL: Record<VersionSafetyTone, PillTone> = {
  operating: "signal",
  review: "warn",
  blocked: "danger",
  previous: "mute",
};

const COUNT_ITEMS: ReadonlyArray<{ key: keyof VersionSafetyCounts; label: string }> = [
  { key: "intent", label: "intent" },
  { key: "slot", label: "slot" },
  { key: "policy", label: "policy" },
  { key: "risk", label: "risk" },
  { key: "workflow", label: "workflow" },
];

/**
 * 도메인팩 상세/하위 화면 어디서나 현재 보는 버전의 안전 상태와 배포 전 영향 요약을
 * 고정 노출한다 (#634). pack/version 쿼리를 자체 구독하므로 페이지는 versionId만
 * 넘기면 된다 (동일 query key라 React Query가 dedupe).
 */
export function VersionSafetyBanner({
  wsId,
  packId,
  versionId,
  deployingVersionId = null,
  applyingVersionId = null,
}: VersionSafetyBannerProps) {
  const packQuery = usePackDetail(wsId, packId);
  const versionQuery = useVersionDetail(wsId, packId, versionId);

  const pack = packQuery.data as DomainPackDetail | undefined;
  const version = versionQuery.data as DomainPackVersionDetail | undefined;

  if (versionId === null) return null;

  if (!pack || !version) {
    if (packQuery.isLoading || versionQuery.isLoading) {
      return (
        <div className={styles.skeleton} aria-hidden>
          <div className={styles.skeletonBar} />
        </div>
      );
    }
    return null;
  }

  const currentVersionId = pack.currentVersionId ?? null;
  const currentVersionNo =
    pack.currentVersionNo ??
    pack.versions?.find((v) => v.versionId === currentVersionId)?.versionNo ??
    null;

  const state = buildVersionSafetyState({
    version,
    versions: pack.versions ?? [],
    currentVersionId,
    currentVersionNo,
    deployingVersionId,
    applyingVersionId,
  });

  return (
    <section className={styles.banner} data-tone={state.tone} aria-label="버전 안전성 정보">
      <div className={styles.top}>
        <span className={styles.versionNo}>
          {state.versionNo == null ? "버전" : `v${state.versionNo}`}
        </span>
        <Pill tone={TONE_TO_PILL[state.tone]}>{state.lifecycleLabel}</Pill>
        {state.isCurrent ? <Pill tone="mute">배포중</Pill> : null}
        {state.isDraft && !state.isCurrent ? <Pill tone="mute">검토본</Pill> : null}
        <span className={styles.transition}>{state.transitionLabel}</span>
      </div>

      {state.changeDescription ? (
        <p className={styles.description}>{state.changeDescription}</p>
      ) : null}

      <div className={styles.impact}>
        <span className={styles.impactLabel}>{state.countsLabel}</span>
        <ul className={styles.chips} aria-label="구성요소 요약">
          {COUNT_ITEMS.map((item) => (
            <li key={item.key} className={styles.chip}>
              <span className={styles.chipLabel}>{item.label}</span>
              <span className={styles.chipValue}>{state.counts[item.key]}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className={styles.reason} role="status">
        {state.reason}
      </p>
    </section>
  );
}
