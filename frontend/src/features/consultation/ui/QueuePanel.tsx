import React, { useMemo, useState } from "react";
import { AlertCircle, Inbox, LoaderCircle, Search } from "lucide-react";
import styles from "./queue-panel.module.css";

export interface QueueCustomer {
  id: string;
  name?: string;
  title?: string;
  channel: string;
  handoffReason: string;
  lastMessage?: string;
  waitMinutes: number;
  hasUnread: boolean;
  lastMessagePreview?: string;
  lastMessageRole?: string;
  lastMessageAt?: string | null;
  lastMessageTimeLabel?: string;
  status?: string | null;
  statusLabel?: string;
  assignedCounselorId?: number | null;
  startedAt?: string | null;
}

interface QueuePanelProps {
  customers: QueueCustomer[];
  activeCustomerId: string | null;
  currentCounselorId: number | null;
  onSelectCustomer: (id: string) => void;
  isLoading?: boolean;
  loadError?: string | null;
  onRetry?: () => void;
}

type QueueFilter = "all" | "mine" | "unassigned" | "unread";

interface QueueFilterOption {
  value: QueueFilter;
  label: string;
}

const FILTER_OPTIONS: QueueFilterOption[] = [
  { value: "all", label: "전체" },
  { value: "mine", label: "내 상담" },
  { value: "unassigned", label: "미배정" },
  { value: "unread", label: "읽지 않음" },
];

const isAssignedToCurrentCounselor = (
  customer: QueueCustomer,
  currentCounselorId: number | null,
) => currentCounselorId != null && customer.assignedCounselorId === currentCounselorId;

const isUnassigned = (customer: QueueCustomer) => customer.assignedCounselorId == null;

const matchesFilter = (
  customer: QueueCustomer,
  selectedFilter: QueueFilter,
  currentCounselorId: number | null,
) => {
  switch (selectedFilter) {
    case "mine":
      return isAssignedToCurrentCounselor(customer, currentCounselorId);
    case "unassigned":
      return isUnassigned(customer);
    case "unread":
      return customer.hasUnread;
    case "all":
    default:
      return true;
  }
};

const normalizeSearch = (value: string) => value.trim().toLocaleLowerCase();

const matchesSearch = (customer: QueueCustomer, searchTerm: string) => {
  const normalizedTerm = normalizeSearch(searchTerm);
  if (!normalizedTerm) return true;

  return [
    customer.name,
    customer.title,
    customer.lastMessage,
    customer.lastMessagePreview,
    customer.handoffReason,
  ]
    .filter(Boolean)
    .some((value) => normalizeSearch(String(value)).includes(normalizedTerm));
};

const getFilterCounts = (customers: QueueCustomer[], currentCounselorId: number | null) => ({
  all: customers.length,
  mine: customers.filter((customer) => isAssignedToCurrentCounselor(customer, currentCounselorId))
    .length,
  unassigned: customers.filter(isUnassigned).length,
  unread: customers.filter((customer) => customer.hasUnread).length,
});

const getInProgressCount = (customers: QueueCustomer[]) =>
  customers.filter(
    (customer) => customer.assignedCounselorId != null || customer.status === "ACTIVE",
  )
    .length;

const getEmptyMessage = (
  customers: QueueCustomer[],
  selectedFilter: QueueFilter,
  searchTerm: string,
) => {
  if (customers.length === 0) return "현재 상담 큐가 비어 있습니다";
  if (normalizeSearch(searchTerm)) return "검색 조건에 맞는 상담이 없습니다";
  if (selectedFilter === "mine") return "내 상담이 없습니다";
  if (selectedFilter === "unassigned") return "미배정 상담이 없습니다";
  if (selectedFilter === "unread") return "읽지 않은 상담이 없습니다";
  return "표시할 상담이 없습니다";
};

export const QueuePanel: React.FC<QueuePanelProps> = ({
  customers,
  activeCustomerId,
  currentCounselorId,
  onSelectCustomer,
  isLoading = false,
  loadError = null,
  onRetry,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<QueueFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const filterCounts = useMemo(
    () => getFilterCounts(customers, currentCounselorId),
    [customers, currentCounselorId],
  );

  const visibleCustomers = useMemo(
    () =>
      customers.filter(
        (customer) =>
          matchesFilter(customer, selectedFilter, currentCounselorId) &&
          matchesSearch(customer, searchTerm),
      ),
    [customers, currentCounselorId, searchTerm, selectedFilter],
  );

  const inProgressCount = useMemo(() => getInProgressCount(customers), [customers]);
  const emptyMessage = getEmptyMessage(customers, selectedFilter, searchTerm);

  const renderQueueState = () => {
    if (isLoading) {
      return (
        <div className={styles.emptyQueue} aria-live="polite">
          <LoaderCircle size={36} className={styles.loadingIcon} />
          <p className={styles.emptyText}>대기열을 불러오는 중입니다</p>
        </div>
      );
    }

    if (loadError) {
      return (
        <div className={styles.emptyQueue} role="alert">
          <AlertCircle size={36} className={styles.emptyIcon} />
          <p className={styles.emptyText}>{loadError}</p>
          {onRetry && (
            <button type="button" className={styles.retryButton} onClick={onRetry}>
              다시 시도
            </button>
          )}
        </div>
      );
    }

    if (visibleCustomers.length === 0) {
      return (
        <div className={styles.emptyQueue}>
          <Inbox size={40} className={styles.emptyIcon} />
          <p className={styles.emptyText}>{emptyMessage}</p>
        </div>
      );
    }

    return visibleCustomers.map((c) => {
      const displayName = c.name?.trim() || "Unknown";
      const subject = c.lastMessagePreview?.trim() || c.title?.trim() || c.handoffReason;
      return (
        <div
          key={c.id}
          role="button"
          tabIndex={0}
          className={`${styles.queueItem} ${activeCustomerId === c.id ? styles.queueItemActive : ""}`}
          onClick={() => onSelectCustomer(c.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectCustomer(c.id);
            }
          }}
        >
          <div
            className={`${styles.customerAvatar} ${activeCustomerId === c.id ? styles.customerAvatarActive : ""}`}
          >
            {displayName.charAt(0)}
          </div>
          <div className={styles.queueItemInfo}>
            <div className={styles.customerName}>{displayName}</div>
            <div className={styles.handoffPreview}>{subject}</div>
            {c.statusLabel && <div className={styles.sessionStatus}>{c.statusLabel}</div>}
          </div>
          <div className={styles.queueItemMeta}>
            <span className={styles.waitTime}>
              {c.lastMessageTimeLabel || `${c.waitMinutes}분 전`}
            </span>
            {c.hasUnread && (
              <span className={styles.unreadDot} role="status" aria-label="읽지 않은 고객 메시지" />
            )}
          </div>
        </div>
      );
    });
  };

  return (
    <aside className={styles.queueWrapper}>
      <div className={styles.queueHeader}>
        <h3 className={styles.queueTitle}>상담 큐</h3>
        <span className={styles.queueCount}>
          미배정 {filterCounts.unassigned}건 · 진행 {inProgressCount}건
        </span>
        <label className={styles.searchBox}>
          <Search size={14} className={styles.searchIcon} aria-hidden="true" />
          <input
            aria-label="상담 큐 검색"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="고객명, 제목, 메시지"
            className={styles.searchInput}
          />
        </label>
        <div className={styles.filterTabs} aria-label="상담 큐 필터">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${styles.filterTab} ${
                selectedFilter === option.value ? styles.filterTabActive : ""
              }`}
              aria-pressed={selectedFilter === option.value}
              onClick={() => setSelectedFilter(option.value)}
            >
              <span>{option.label}</span>
              <span className={styles.filterCount}>{filterCounts[option.value]}</span>
            </button>
          ))}
        </div>
        <span className={styles.resultCount}>현재 {visibleCustomers.length}건 표시</span>
      </div>

      <div className={styles.queueList}>{renderQueueState()}</div>
    </aside>
  );
};
