import { ArrowRightIcon } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";

import { unwrapApiResponse } from "@/shared/api";
import { useListDomainPacks } from "@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller";
import type { DomainPackSummaryResult } from "@/shared/api/generated/zod";
import { domainPackPath } from "@/shared/lib/domainPackRoutes";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { EmptyState } from "@/shared/ui/ostone/atoms/EmptyState";
import { ErrorState } from "@/shared/ui/ostone/atoms/ErrorState";
import { LoadingSpinner } from "@/shared/ui/ostone/atoms/LoadingSpinner";

import styles from "./domain-pack-list-page.module.css";

function isOperatingPack(pack: DomainPackSummaryResult): boolean {
  return pack.currentVersionId != null;
}

function displayPackName(pack: DomainPackSummaryResult): string {
  return pack.name || `Pack ${pack.packId ?? "-"}`;
}

function formatDate(value?: string | null): string {
  if (!value) return "기록 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "기록 없음";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function buildVersionLabel(pack: DomainPackSummaryResult): string {
  if (!isOperatingPack(pack)) return "운영 버전 없음";
  return `v${pack.currentVersionNo ?? "-"}`;
}

interface PackSectionProps {
  id: string;
  title: string;
  count: number;
  emptyMessage: string;
  packs: DomainPackSummaryResult[];
  workspaceId: number;
}

function PackSection({ id, title, count, emptyMessage, packs, workspaceId }: PackSectionProps) {
  return (
    <section className={styles.packSection} aria-labelledby={id}>
      <div className={styles.sectionHeader}>
        <h2 id={id} className={styles.sectionTitle}>
          {title}
        </h2>
        <span className={styles.sectionCount}>{count}</span>
      </div>

      {packs.length === 0 ? (
        <div className={styles.sectionEmpty}>{emptyMessage}</div>
      ) : (
        <div className={styles.packGrid}>
          {packs.map((pack, index) => {
            const operating = isOperatingPack(pack);
            const packId = pack.packId ?? 0;
            const packName = displayPackName(pack);
            const listKey = pack.packId ?? `${packName}-${index}`;

            return (
              <Link
                key={listKey}
                to={domainPackPath(workspaceId, packId)}
                className={styles.packCard}
              >
                <div className={styles.cardTopRow}>
                  <span className={operating ? styles.statusBadgeOperating : styles.statusBadgeIdle}>
                    {operating ? "운영중" : "비운영"}
                  </span>
                  <span className={styles.versionText}>{buildVersionLabel(pack)}</span>
                </div>
                <div className={styles.cardMain}>
                  <h3 className={styles.packName}>{packName}</h3>
                  {pack.description ? (
                    <p className={styles.packDescription}>{pack.description}</p>
                  ) : (
                    <p className={styles.packDescriptionMuted}>설명 없음</p>
                  )}
                </div>
                <div className={styles.cardMeta}>
                  <span>
                    {operating
                      ? `게시 ${formatDate(pack.currentVersionPublishedAt)}`
                      : `생성 ${formatDate(pack.createdAt)}`}
                  </span>
                  <ArrowRightIcon className={styles.cardArrow} aria-hidden="true" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function DomainPackListPage() {
  const { workspaceId } = useParams();
  const parsedWorkspaceId = parseRouteId(workspaceId);
  const safeWorkspaceId = parsedWorkspaceId ?? 0;

  const query = useListDomainPacks(safeWorkspaceId, {
    query: { enabled: parsedWorkspaceId !== null },
  });

  if (parsedWorkspaceId === null) {
    return <Navigate to="/workspaces" replace />;
  }

  if (query.isLoading) {
    return (
      <div className={styles.statePanel} data-testid="domain-packs-loading">
        <LoadingSpinner />
        <p className={styles.stateText}>도메인 팩 목록을 불러오는 중입니다.</p>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className={styles.errorPanel} data-testid="domain-packs-error">
        <ErrorState message="도메인 팩 목록을 불러오지 못했습니다." onRetry={() => query.refetch()} />
      </div>
    );
  }

  const packs = unwrapApiResponse<DomainPackSummaryResult[]>(query.data) ?? [];

  if (packs.length === 0) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.emptyPanel}>
          <EmptyState message="아직 도메인팩이 없습니다. 상담 로그를 업로드하여 첫 도메인팩을 생성하세요." />
        </div>
      </div>
    );
  }

  const operatingPacks = packs.filter(isOperatingPack);
  const idlePacks = packs.filter((pack) => !isOperatingPack(pack));

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Domain Packs</h1>
          <div className={styles.summaryRow} aria-label="도메인팩 상태 요약">
            <span className={styles.summaryPill}>전체 {packs.length}</span>
            <span className={styles.summaryPill}>운영중 {operatingPacks.length}</span>
            <span className={styles.summaryPill}>비운영 {idlePacks.length}</span>
          </div>
        </div>
      </div>

      <div className={styles.sections}>
        <PackSection
          id="operating-domain-packs"
          title="운영중인 도메인팩"
          count={operatingPacks.length}
          emptyMessage="운영중인 도메인팩이 없습니다."
          packs={operatingPacks}
          workspaceId={parsedWorkspaceId}
        />
        <PackSection
          id="idle-domain-packs"
          title="비운영 도메인팩"
          count={idlePacks.length}
          emptyMessage="비운영 도메인팩이 없습니다."
          packs={idlePacks}
          workspaceId={parsedWorkspaceId}
        />
      </div>
    </div>
  );
}
