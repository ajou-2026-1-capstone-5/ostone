import React from 'react';
import { PhoneOff } from 'lucide-react';
import styles from './status-bar.module.css';

interface StatusBarProps {
  status: string;
  category: string;
  onStatusChange: (status: string) => void;
  onCategoryChange: (category: string) => void;
  onEndSession: () => void;
  disabled: boolean;
}

const STATUS_OPTIONS = [
  { value: 'WAITING', label: '대기중' },
  { value: 'IN_PROGRESS', label: '진행중' },
  { value: 'ON_HOLD', label: '보류' },
  { value: 'COMPLETED', label: '완료' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: '카테고리 선택' },
  { value: 'REFUND', label: '환불' },
  { value: 'DELIVERY', label: '배송' },
  { value: 'PAYMENT', label: '결제' },
  { value: 'PRODUCT', label: '상품 문의' },
  { value: 'ACCOUNT', label: '계정' },
  { value: 'OTHER', label: '기타' },
];

export const StatusBar: React.FC<StatusBarProps> = ({
  status,
  category,
  onStatusChange,
  onCategoryChange,
  onEndSession,
  disabled,
}) => {
  return (
    <div className={styles.statusBarWrapper}>
      <div className={styles.statusLeft}>
        <div className={styles.statusGroup}>
          <span className={styles.statusLabel}>상태</span>
          <select
            className={styles.statusSelect}
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            disabled={disabled}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.divider}></div>

        <div className={styles.statusGroup}>
          <span className={styles.statusLabel}>카테고리</span>
          <select
            className={styles.statusSelect}
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            disabled={disabled}
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        className={styles.endBtn}
        onClick={onEndSession}
        disabled={disabled}
      >
        <PhoneOff size={16} />
        상담 종료
      </button>
    </div>
  );
};
