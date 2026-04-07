import React from 'react';
import { User, Clock, AlertTriangle, Monitor } from 'lucide-react';
import styles from './customer-info-panel.module.css';

interface CustomerInfoPanelProps {
  customer: {
    name: string;
    channel: string;
    handoffReason: string;
    waitMinutes: number;
  } | null;
  memo: string;
  onMemoChange: (memo: string) => void;
}

export const CustomerInfoPanel: React.FC<CustomerInfoPanelProps> = ({
  customer,
  memo,
  onMemoChange,
}) => {
  if (!customer) {
    return (
      <aside className={styles.infoWrapper}>
        <div className={styles.emptyInfo}>
          <User size={40} className={styles.emptyInfoIcon} />
          <p className={styles.emptyInfoText}>고객을 선택하면<br/>정보가 표시됩니다</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.infoWrapper}>
      {/* Customer Profile */}
      <div className={styles.infoSection}>
        <div className={styles.sectionTitle}>고객 정보</div>
        <div className={styles.profileArea}>
          <div className={styles.profileAvatar}>{customer.name.charAt(0)}</div>
          <div>
            <div className={styles.profileName}>{customer.name}</div>
            <div className={styles.profileChannel}>{customer.channel}</div>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className={styles.infoSection}>
        <div className={styles.sectionTitle}>상담 상세</div>

        <div className={styles.detailRow}>
          <Monitor size={16} className={styles.detailIcon} />
          <div>
            <div className={styles.detailLabel}>유입 채널</div>
            <div className={styles.detailValue}>{customer.channel}</div>
          </div>
        </div>

        <div className={styles.detailRow}>
          <Clock size={16} className={styles.detailIcon} />
          <div>
            <div className={styles.detailLabel}>대기 시간</div>
            <div className={styles.detailValue}>{customer.waitMinutes}분</div>
          </div>
        </div>

        <div className={styles.detailRow}>
          <AlertTriangle size={16} className={styles.detailIcon} />
          <div>
            <div className={styles.detailLabel}>핸드오프 사유</div>
            <div className={styles.handoffBadge}>{customer.handoffReason}</div>
          </div>
        </div>
      </div>

      {/* Memo */}
      <div className={styles.infoSection}>
        <div className={styles.sectionTitle}>상담 메모</div>
        <div className={styles.memoArea}>
          <textarea
            className={styles.memoTextarea}
            placeholder="상담 메모를 입력하세요..."
            value={memo}
            onChange={(e) => onMemoChange(e.target.value)}
          />
        </div>
      </div>
    </aside>
  );
};
