import { useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useChatSessions } from "../../../../features/consultation/api/chatHistoryApi";
import { MessageHistory } from "../../../../features/consultation/ui/chat-history/MessageHistory";
import type { SessionListFilters } from "../../../../features/consultation/ui/chat-history/SessionList";
import { SessionList } from "../../../../features/consultation/ui/chat-history/SessionList";
import { parseRouteId } from "../../../../shared/lib/parseRouteId";
import styles from "./ChatHistoryPage.module.css";

interface ChatHistoryPageProps {
  workspaceId?: number;
}

const DEFAULT_STATUS = "COMPLETED";
const ALL_STATUS = "ALL";
const PAGE_SIZE = 20;

function parsePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function parsePositiveNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function ChatHistoryPage({ workspaceId: workspaceIdProp }: ChatHistoryPageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { workspaceId: workspaceIdParam, sessionId: sessionIdParam } = useParams<{
    workspaceId: string;
    sessionId: string;
  }>();
  const workspaceId = workspaceIdProp ?? parseRouteId(workspaceIdParam);
  const selectedSessionId = sessionIdParam ?? null;
  const page = parsePage(searchParams.get("page"));
  const filters: SessionListFilters = {
    keyword: searchParams.get("q") ?? "",
    status: searchParams.get("status") ?? DEFAULT_STATUS,
    startedFrom: searchParams.get("startedFrom") ?? "",
    startedTo: searchParams.get("startedTo") ?? "",
    assignedCounselorId: searchParams.get("assignedCounselorId") ?? "",
  };
  const {
    data: sessionPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useChatSessions({
    workspaceId,
    status: filters.status === ALL_STATUS ? undefined : filters.status || undefined,
    keyword: filters.keyword || undefined,
    startedFrom: filters.startedFrom || undefined,
    startedTo: filters.startedTo || undefined,
    assignedCounselorId: parsePositiveNumber(filters.assignedCounselorId),
    page,
    size: PAGE_SIZE,
  });
  const sessions = useMemo(() => sessionPage?.content ?? [], [sessionPage?.content]);
  const selectableSessionIds = useMemo(
    () =>
      new Set(sessions.filter((session) => session.id != null).map((session) => String(session.id))),
    [sessions],
  );
  const hasSelectedSession =
    selectedSessionId !== null && selectableSessionIds.has(selectedSessionId);
  const isSelectionPending = selectedSessionId !== null && isLoading;
  const missingSessionId =
    selectedSessionId !== null && !isLoading && !isError && !hasSelectedSession
      ? selectedSessionId
      : null;

  const handleSelectSession = (sessionId: string) => {
    if (workspaceId === null) return;
    const query = searchParams.toString();
    navigate({
      pathname: `/workspaces/${workspaceId}/consultation/history/${sessionId}`,
      search: query ? `?${query}` : "",
    });
  };

  const updateFilters = (nextFilters: Partial<SessionListFilters>) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        const entries: Array<[keyof SessionListFilters, string]> = [
          ["keyword", nextFilters.keyword ?? filters.keyword],
          ["status", nextFilters.status ?? filters.status],
          ["startedFrom", nextFilters.startedFrom ?? filters.startedFrom],
          ["startedTo", nextFilters.startedTo ?? filters.startedTo],
          ["assignedCounselorId", nextFilters.assignedCounselorId ?? filters.assignedCounselorId],
        ];
        const queryKeyMap: Record<keyof SessionListFilters, string> = {
          keyword: "q",
          status: "status",
          startedFrom: "startedFrom",
          startedTo: "startedTo",
          assignedCounselorId: "assignedCounselorId",
        };

        entries.forEach(([key, value]) => {
          const queryKey = queryKeyMap[key];
          if (value) {
            next.set(queryKey, value);
          } else {
            next.delete(queryKey);
          }
        });
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  };

  const resetFilters = () => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("q");
        next.set("status", DEFAULT_STATUS);
        next.delete("startedFrom");
        next.delete("startedTo");
        next.delete("assignedCounselorId");
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  };

  const handlePageChange = (nextPage: number) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (nextPage <= 0) {
          next.delete("page");
        } else {
          next.set("page", String(nextPage));
        }
        return next;
      },
      { replace: true },
    );
  };

  return (
    <main className={styles.page}>
      <SessionList
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        onSelectSession={handleSelectSession}
        filters={filters}
        onFiltersChange={updateFilters}
        onResetFilters={resetFilters}
        page={sessionPage?.page ?? page}
        totalPages={sessionPage?.totalPages ?? 0}
        totalElements={sessionPage?.totalElements ?? 0}
        onPageChange={handlePageChange}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
      />
      <div className={styles.contentPane}>
        <MessageHistory
          sessionId={hasSelectedSession ? selectedSessionId : null}
          isSelectionPending={isSelectionPending}
          missingSessionId={missingSessionId}
        />
      </div>
    </main>
  );
}
