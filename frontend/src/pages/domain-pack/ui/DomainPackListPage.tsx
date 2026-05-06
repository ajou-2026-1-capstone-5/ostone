import { useParams, Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LoadingSpinner } from "@/shared/ui/ostone/atoms/LoadingSpinner";
import { ErrorState } from "@/shared/ui/ostone/atoms/ErrorState";
import { EmptyState } from "@/shared/ui/ostone/atoms/EmptyState";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { customFetch } from "@/shared/api/mutator";
import type { DomainPackDetailResult } from "@/shared/api/generated/zod";

async function listDomainPacks(workspaceId: number): Promise<{ data: DomainPackDetailResult[] }> {
  return customFetch<{ data: DomainPackDetailResult[] }>(`/api/v1/workspaces/${workspaceId}/domain-packs`, {
    method: "GET",
  });
}

export function DomainPackListPage() {
  const { workspaceId } = useParams();
  const parsedWorkspaceId = parseRouteId(workspaceId);

  const query = useQuery({
    queryKey: ["/api/v1/workspaces", parsedWorkspaceId, "domain-packs"],
    queryFn: () => listDomainPacks(parsedWorkspaceId!),
    enabled: parsedWorkspaceId !== null,
  });

  if (parsedWorkspaceId === null) {
    return <Navigate to="/workspaces" replace />;
  }

  if (query.isLoading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--s-3)",
          height: "100%",
        }}
      >
        <LoadingSpinner />
        <p style={{ color: "var(--ink)", fontSize: "14px" }}>도메인 팩 목록을 불러오는 중입니다.</p>
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        message="도메인 팩 목록을 불러오지 못했습니다."
        onRetry={() => query.refetch()}
      />
    );
  }

  const packs = query.data?.data ?? [];

  if (packs.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--s-4)",
          }}
        >
          <EmptyState message="아직 도메인팩이 없습니다. 상담 로그를 업로드하여 첫 도메인팩을 생성하세요." />
          <Link
            to={`/workspaces/${parsedWorkspaceId}/upload`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "var(--s-2) var(--s-4)",
              borderRadius: "var(--r-2)",
              background: "var(--ink)",
              color: "var(--paper)",
              fontSize: "13px",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            상담 로그 업로드
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--s-6) var(--s-8) var(--s-10)" }}>
      <h1
        style={{
          fontSize: "20px",
          fontWeight: 500,
          color: "var(--ink)",
          marginBottom: "var(--s-4)",
        }}
      >
        Domain Packs
      </h1>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--s-3)",
        }}
      >
        {packs.map((pack) => (
          <Link
            key={pack.packId}
            to={`/workspaces/${parsedWorkspaceId}/domain-packs/${pack.packId}`}
            style={{
              display: "block",
              padding: "var(--s-4)",
              background: "var(--paper-2)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-2)",
              textDecoration: "none",
              color: "var(--ink)",
              transition: "background 120ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--paper-3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--paper-2)";
            }}
          >
            <div style={{ fontSize: "15px", fontWeight: 500, marginBottom: "var(--s-1)" }}>
              {pack.name || `Pack ${pack.packId}`}
            </div>
            {pack.description && (
              <div style={{ fontSize: "13px", color: "var(--ink-3)" }}>
                {pack.description}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
