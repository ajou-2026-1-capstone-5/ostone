import React from 'react';
import { Inbox, Search } from 'lucide-react';
import { Pill } from '@/shared/ui/atoms/Pill';
import { Dot } from '@/shared/ui/atoms/Dot';
import styles from './queue-panel.module.css';

export interface QueueCustomer {
  id: string;
  name: string;
  channel: string;
  handoffReason: string;
  waitMinutes: number;
  hasUnread: boolean;
  topic?: string;
  urgent?: boolean;
}

interface QueuePanelProps {
  customers: QueueCustomer[];
  activeCustomerId: string | null;
  onSelectCustomer: (id: string) => void;
  filterTab?: 'all' | 'urgent' | 'mine';
  onFilterChange?: (tab: 'all' | 'urgent' | 'mine') => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  isLoading?: boolean;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({
  customers,
  activeCustomerId,
  onSelectCustomer,
  filterTab = 'all',
  onFilterChange,
  searchQuery = '',
  onSearchChange,
  isLoading = false,
}) => {
  const tabs: { key: 'all' | 'urgent' | 'mine'; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'urgent', label: '긴급' },
    { key: 'mine', label: '내 담당' },
  ];

  const urgentCount = customers.filter((c) => c.urgent).length;

  return (
    <aside className={styles.queueWrapper}>
      <div className={styles.queueHeader}>
        <div className={styles.queueHeaderTop}>
          <h3 className={styles.queueTitle}>대기 중인 고객</h3>
          {urgentCount > 0 && (
            <Pill tone="danger" size="sm">
              {urgentCount}건 긴급
            </Pill>
          )}
        </div>
        <div className={styles.filterTabs}>
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`${styles.filterTab} ${filterTab === t.key ? styles.filterTabActive : ''}`}
              onClick={() => onFilterChange?.(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className={styles.searchBox}>
          <Search size={14} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="검색..."
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.queueList}>
        {isLoading ? (
          <div className={styles.skeletonList}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={styles.skeletonRow}>
                <div className={styles.skeletonAvatar} />
                <div className={styles.skeletonLines}>
                  <div className={styles.skeletonLine} />
                  <div className={styles.skeletonLineShort} />
                </div>
              </div>
            ))}
          </div>
        ) : customers.length === 0 ? (
          <div className={styles.emptyQueue}>
            <Inbox size={40} className={styles.emptyIcon} />
            <p className={styles.emptyText}>대기 중인 고객이 없습니다</p>
          </div>
        ) : (
          customers.map((c) => (
            <div
              key={c.id}
              className={`${styles.queueItem} ${activeCustomerId === c.id ? styles.queueItemActive : ''}`}
              onClick={() => onSelectCustomer(c.id)}
            >
              <div
                className={`${styles.customerAvatar} ${activeCustomerId === c.id ? styles.customerAvatarActive : ''}`}
              >
                {c.name.charAt(0)}
              </div>
              <div className={styles.queueItemInfo}>
                <div className={styles.customerName}>{c.name}</div>
                <div className={styles.queueItemMeta}>
                  <span>{c.channel}</span>
                  <span>·</span>
                  <span className={c.waitMinutes > 5 ? styles.waitTimeUrgent : ''}>
                    {c.waitMinutes < 1 ? '방금' : `${c.waitMinutes}분 대기`}
                  </span>
                </div>
                {c.topic && (
                  <div className={styles.topicPillWrap}>
                    <Pill tone={c.urgent ? 'warn' : 'info'} size="sm">
                      {c.topic}
                    </Pill>
                  </div>
                )}
              </div>
              <div className={styles.queueItemRight}>
                {c.urgent && <Dot tone="danger" size={6} />}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
};
