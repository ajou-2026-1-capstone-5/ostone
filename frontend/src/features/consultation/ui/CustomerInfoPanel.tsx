import React from 'react';
import { User, Clock, Monitor, CheckCircle } from 'lucide-react';
import { Eyebrow } from '@/shared/ui/atoms/Eyebrow';
import { Mono } from '@/shared/ui/atoms/Mono';
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
  timeline?: Array<{
    name: string;
    description: string;
    status: 'done' | 'active' | 'pending';
  }>;
  checklist?: Array<{
    label: string;
    value: string;
    ok?: boolean;
    missing?: boolean;
  }>;
  orderInfo?: {
    orderId: string;
    date: string;
    title: string;
    price: string;
    card: string;
    deliveryStatus: string;
    refundDeadline: string;
  } | null;
}

const defaultTimeline = [
  { name: '필요 정보 수집', description: '주문번호 · 카드번호 확인 완료', status: 'done' as const },
  { name: '환불 조건 확인', description: '부분환불 정책 검토 중', status: 'active' as const },
  { name: '환불 처리', description: '5,000원 부분환불', status: 'pending' as const },
  { name: '완료 안내', description: '영수증 발송', status: 'pending' as const },
];

const defaultChecklist = [
  { label: '주문번호', value: 'ORD-44218', ok: true },
  { label: '결제 금액', value: '12,800원', ok: true },
  { label: '환불 요청액', value: '5,000원', ok: true },
  { label: '환불 사유', value: '아직 확인 안 됨 — 고객에게 물어보세요', missing: true },
];

const defaultOrderInfo = {
  orderId: 'ORD-44218',
  date: '어제 18:42',
  title: '오늘의 신선반찬 외 2건',
  price: '12,800원',
  card: '카드 ****4421',
  deliveryStatus: '배송 완료',
  refundDeadline: '6일 남음',
};

export const CustomerInfoPanel: React.FC<CustomerInfoPanelProps> = ({
  customer,
  memo,
  onMemoChange,
  timeline,
  checklist,
  orderInfo,
}) => {
  if (!customer) {
    return (
      <aside className={styles.infoWrapper}>
        <div className={styles.emptyInfo}>
          <User size={40} className={styles.emptyInfoIcon} />
          <p className={styles.emptyInfoText}>고객 정보가 없습니다</p>
        </div>
      </aside>
    );
  }

  const activeTimeline = timeline && timeline.length > 0 ? timeline : defaultTimeline;
  const activeChecklist = checklist && checklist.length > 0 ? checklist : defaultChecklist;
  const activeOrder = orderInfo ?? defaultOrderInfo;

  return (
    <aside className={styles.infoWrapper}>
      <div className={styles.infoSection}>
        <Eyebrow>고객 정보</Eyebrow>
        <div className={styles.profileArea}>
          <div className={styles.profileAvatar}>{customer.name.charAt(0)}</div>
          <div>
            <div className={styles.profileName}>{customer.name}</div>
            <div className={styles.profileChannel}>{customer.channel}</div>
          </div>
        </div>
        <div className={styles.profileMeta}>
          <div className={styles.metaRow}>
            <Monitor size={14} className={styles.metaIcon} />
            <span className={styles.metaLabel}>채널</span>
            <span className={styles.metaValue}>{customer.channel}</span>
          </div>
          <div className={styles.metaRow}>
            <Clock size={14} className={styles.metaIcon} />
            <span className={styles.metaLabel}>대기 시간</span>
            <span className={styles.metaValue}>{customer.waitMinutes}분</span>
          </div>
        </div>
      </div>

      <div className={styles.infoSection}>
        <Eyebrow>문의 관련 주문</Eyebrow>
        <div className={styles.orderCard}>
          <div className={styles.orderHeader}>
            <Mono size={12}>{activeOrder.orderId}</Mono>
            <span className={styles.orderDate}>{activeOrder.date}</span>
          </div>
          <div className={styles.orderTitle}>{activeOrder.title}</div>
          <div className={styles.orderPrice}>
            결제: <Mono size={12}>{activeOrder.price}</Mono> · {activeOrder.card}
          </div>
          <div className={styles.orderFooter}>
            {activeOrder.deliveryStatus} · 환불 가능 기간{' '}
            <span className={styles.orderHighlight}>{activeOrder.refundDeadline}</span>
          </div>
        </div>
      </div>

      <div className={styles.infoSection}>
        <div className={styles.timelineHeader}>
          <Eyebrow>처리 단계</Eyebrow>
          <Mono size={10} className={styles.timelineCounter}>
            {activeTimeline.filter((t) => t.status === 'done').length} / {activeTimeline.length}
          </Mono>
        </div>
        <div className={styles.timeline}>
          <div className={styles.timelineLine} />
          {activeTimeline.map((item) => (
            <div key={item.name} className={styles.timelineItem}>
              <div
                className={`${styles.timelineDot} ${
                  item.status === 'done'
                    ? styles.timelineDotDone
                    : item.status === 'active'
                    ? styles.timelineDotActive
                    : styles.timelineDotPending
                }`}
              >
                {item.status === 'done' && <CheckCircle size={10} className={styles.timelineCheck} />}
                {item.status === 'active' && <span className={styles.timelineInnerDot} />}
              </div>
              <div
                className={`${styles.timelineName} ${
                  item.status === 'active' ? styles.timelineNameActive : item.status === 'pending' ? styles.timelineNamePending : ''
                }`}
              >
                {item.name}
              </div>
              <div
                className={`${styles.timelineDesc} ${
                  item.status === 'pending' ? styles.timelineDescPending : ''
                }`}
              >
                {item.description}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.infoSection}>
        <Eyebrow>확인된 정보</Eyebrow>
        <div className={styles.checklist}>
          {activeChecklist.map((item) => (
            <div key={item.label} className={styles.checklistItem}>
              <span
                className={`${styles.checklistIcon} ${
                  item.ok ? styles.checklistIconOk : styles.checklistIconMissing
                }`}
              >
                {item.ok ? <CheckCircle size={10} /> : <span className={styles.checklistWarn}>!</span>}
              </span>
              <div className={styles.checklistContent}>
                <div className={styles.checklistLabel}>{item.label}</div>
                <div
                  className={`${styles.checklistValue} ${
                    item.missing ? styles.checklistValueMissing : ''
                  }`}
                >
                  {item.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.infoSection}>
        <label htmlFor="consultation-memo" className={styles.sectionTitle}>내부 메모</label>
        <div className={styles.memoArea}>
          <textarea
            id="consultation-memo"
            className={styles.memoTextarea}
            placeholder="다음 상담사를 위해 메모를 남겨주세요…"
            value={memo}
            onChange={(e) => onMemoChange(e.target.value)}
          />
        </div>
      </div>
    </aside>
  );
};
