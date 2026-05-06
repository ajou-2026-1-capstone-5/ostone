import { useParams, Link } from "react-router-dom";
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
    return <ErrorState message="잘못된 워크스페이스 ID입니다." />;
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
        <EmptyState message="등록된 도메인 팩이 없습니다." />
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
