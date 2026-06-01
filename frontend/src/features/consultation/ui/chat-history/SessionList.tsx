import { ChevronLeftIcon, ChevronRightIcon, RotateCcwIcon, SearchIcon } from "lucide-react";
import { EmptyState, ErrorState, Eyebrow, LoadingSpinner } from "@/shared/ui/ostone/atoms";
import {
  CHAT_HISTORY_ALL_STATUS,
  CHAT_HISTORY_DEFAULT_STATUS,
} from "../../lib/chatHistoryFilterDefaults";
import type { ChatSession } from "../../api/consultationApi";
import { SessionCard } from "./SessionCard";
import styles from "./SessionList.module.css";

export interface SessionListFilters {
  keyword: string;
  status: string;
  startedFrom: string;
  startedTo: string;
  assignedCounselorId: string;
}

interface SessionListProps {
  sessions: ChatSession[];
  selectedSessionId?: string | null;
  onSelectSession: (sessionId: string) => void;
  filters: SessionListFilters;
  onFiltersChange: (filters: Partial<SessionListFilters>) => void;
  onResetFilters: () => void;
  page: number;
  totalPages: number;
  totalElements: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry: () => void;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "채팅 기록을 불러오지 못했습니다";
}

export function SessionList({
  sessions,
  selectedSessionId,
  onSelectSession,
  filters,
  onFiltersChange,
  onResetFilters,
  page,
  totalPages,
  totalElements,
  onPageChange,
  isLoading = false,
  isError = false,
  error,
  onRetry,
}: SessionListProps) {
  const validSessions = sessions.filter(
    (session): session is typeof session & { id: number } => session.id != null,
  );
  const hasFilters =
    Boolean(filters.keyword) ||
    filters.status !== CHAT_HISTORY_DEFAULT_STATUS ||
    Boolean(filters.startedFrom) ||
    Boolean(filters.startedTo) ||
    Boolean(filters.assignedCounselorId);
  const emptyMessage = hasFilters
    ? "검색 조건에 맞는 상담 기록이 없습니다"
    : "아직 채팅 기록이 없습니다";
  const canGoPrev = page > 0 && !isLoading;
  const canGoNext = page + 1 < totalPages && !isLoading;
  const pageLabel = totalPages > 0 ? `${page + 1} / ${totalPages}` : "0 / 0";

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className={styles.stateArea}>
          <LoadingSpinner />
        </div>
      );
    }

    if (isError) {
      return (
        <div className={styles.stateArea}>
          <ErrorState message={getErrorMessage(error)} onRetry={onRetry} />
        </div>
      );
    }

    if (validSessions.length === 0) {
      return (
        <div className={styles.stateArea}>
          <EmptyState message={emptyMessage} />
        </div>
      );
    }

    return (
      <div className={styles.list}>
        {validSessions.map((session) => {
          const sessionId = String(session.id);
          return (
            <SessionCard
              key={sessionId}
              session={session}
              isSelected={selectedSessionId === sessionId}
              onSelectSession={onSelectSession}
            />
          );
        })}
      </div>
    );
  };

  return (
    <aside className={styles.wrapper} aria-label="채팅 기록 목록">
      <div className={styles.header}>
        <Eyebrow>상담 이력</Eyebrow>
        <span className={styles.count}>
          {isError ? "오류" : isLoading ? "불러오는 중" : `${totalElements}개 세션`}
        </span>
      </div>

      <div className={styles.filters} aria-label="상담 기록 검색 필터">
        <label className={styles.searchBox}>
          <SearchIcon size={14} className={styles.searchIcon} aria-hidden="true" />
          <input
            aria-label="상담 기록 검색"
            value={filters.keyword}
            onChange={(event) => onFiltersChange({ keyword: event.target.value })}
            placeholder="고객명, 키워드"
            className={styles.searchInput}
          />
        </label>

        <label className={styles.field}>
          <span>상태</span>
          <select
            aria-label="상태 필터"
            value={filters.status}
            onChange={(event) => onFiltersChange({ status: event.target.value })}
            className={styles.select}
          >
            <option value={CHAT_HISTORY_ALL_STATUS}>전체 상태</option>
            <option value="COMPLETED">상담 종료</option>
            <option value="RESOLVED">해결됨</option>
            <option value="ACTIVE">진행 중</option>
            <option value="OPEN">대기 중</option>
          </select>
        </label>

        <div className={styles.dateRow}>
          <label className={styles.field}>
            <span>시작일</span>
            <input
              aria-label="시작일 필터"
              type="date"
              value={filters.startedFrom}
              onChange={(event) => onFiltersChange({ startedFrom: event.target.value })}
              className={styles.input}
            />
          </label>
          <label className={styles.field}>
            <span>종료일</span>
            <input
              aria-label="종료일 필터"
              type="date"
              value={filters.startedTo}
              onChange={(event) => onFiltersChange({ startedTo: event.target.value })}
              className={styles.input}
            />
          </label>
        </div>

        <div className={styles.filterActions}>
          <label className={styles.field}>
            <span>상담사 ID</span>
            <input
              aria-label="담당 상담사 필터"
              type="number"
              min="1"
              inputMode="numeric"
              value={filters.assignedCounselorId}
              onChange={(event) => onFiltersChange({ assignedCounselorId: event.target.value })}
              className={styles.input}
            />
          </label>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onResetFilters}
            aria-label="검색 필터 초기화"
          >
            <RotateCcwIcon size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      {renderContent()}

      <div className={styles.pagination} aria-label="상담 기록 페이지 이동">
        <button
          type="button"
          className={styles.pageButton}
          onClick={() => onPageChange(page - 1)}
          disabled={!canGoPrev}
          aria-label="이전 페이지"
        >
          <ChevronLeftIcon size={16} aria-hidden="true" />
        </button>
        <span className={styles.pageStatus}>{pageLabel}</span>
        <button
          type="button"
          className={styles.pageButton}
          onClick={() => onPageChange(page + 1)}
          disabled={!canGoNext}
          aria-label="다음 페이지"
        >
          <ChevronRightIcon size={16} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
