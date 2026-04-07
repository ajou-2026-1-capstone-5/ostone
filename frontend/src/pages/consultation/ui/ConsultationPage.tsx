import React, { useState } from 'react';
import { DashboardLayout } from '../../../shared/ui/layout/DashboardLayout';
import { QueuePanel } from '../../../features/consultation/ui/QueuePanel';
import type { QueueCustomer } from '../../../features/consultation/ui/QueuePanel';
import { ChatPanel } from '../../../features/consultation/ui/ChatPanel';
import type { ChatMessage } from '../../../features/consultation/ui/ChatPanel';
import { CustomerInfoPanel } from '../../../features/consultation/ui/CustomerInfoPanel';
import { StatusBar } from '../../../features/consultation/ui/StatusBar';
import styles from './consultation-page.module.css';

// ─── Mock Data ───────────────────────────────────────────

const MOCK_CUSTOMERS: QueueCustomer[] = [
  { id: '1', name: '김민지', channel: '카카오톡', handoffReason: '결제 오류 해결 불가', waitMinutes: 3, hasUnread: true },
  { id: '2', name: '이준혁', channel: '웹 채팅', handoffReason: '환불 규정 문의', waitMinutes: 7, hasUnread: true },
  { id: '3', name: '박서연', channel: '네이버 톡톡', handoffReason: '배송 지연 불만', waitMinutes: 12, hasUnread: false },
  { id: '4', name: '최도윤', channel: '앱 채팅', handoffReason: '계정 잠금 해제 요청', waitMinutes: 18, hasUnread: false },
];

const MOCK_MESSAGES: Record<string, ChatMessage[]> = {
  '1': [
    { id: 's1', senderRole: 'SYSTEM', content: '챗봇에서 상담자에게 연결되었습니다 · 사유: 결제 오류 해결 불가', timestamp: '' },
    { id: 'm1', senderRole: 'CUSTOMER', content: '안녕하세요, 결제가 계속 안 돼요. 카드번호도 맞는데 자꾸 실패한다고 나와요.', timestamp: '14:32' },
    { id: 'm2', senderRole: 'CUSTOMER', content: '챗봇에서는 해결이 안 돼서 연결해달라고 했어요.', timestamp: '14:32' },
  ],
  '2': [
    { id: 's1', senderRole: 'SYSTEM', content: '챗봇에서 상담자에게 연결되었습니다 · 사유: 환불 규정 문의', timestamp: '' },
    { id: 'm1', senderRole: 'CUSTOMER', content: '3일 전에 주문한 건인데 환불 가능한가요?', timestamp: '14:25' },
    { id: 'm2', senderRole: 'CUSTOMER', content: '주문번호는 ORD-20260405-1023입니다.', timestamp: '14:25' },
  ],
  '3': [
    { id: 's1', senderRole: 'SYSTEM', content: '챗봇에서 상담자에게 연결되었습니다 · 사유: 배송 지연 불만', timestamp: '' },
    { id: 'm1', senderRole: 'CUSTOMER', content: '주문한 지 일주일이 넘었는데 아직도 배송이 안 왔어요. 왜 이렇게 오래 걸리나요?', timestamp: '14:20' },
  ],
  '4': [
    { id: 's1', senderRole: 'SYSTEM', content: '챗봇에서 상담자에게 연결되었습니다 · 사유: 계정 잠금 해제 요청', timestamp: '' },
    { id: 'm1', senderRole: 'CUSTOMER', content: '비밀번호를 여러 번 틀려서 계정이 잠겼어요. 풀어주실 수 있나요?', timestamp: '14:14' },
  ],
};

// ─── Page Component ──────────────────────────────────────

export const ConsultationPage: React.FC = () => {
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>(MOCK_MESSAGES);
  const [memos, setMemos] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Record<string, string>>({});

  const activeCustomer = MOCK_CUSTOMERS.find((c) => c.id === activeCustomerId) || null;
  const activeMessages = activeCustomerId ? (messages[activeCustomerId] || []) : [];

  const handleSelectCustomer = (id: string) => {
    setActiveCustomerId(id);
    if (!statuses[id]) {
      setStatuses((prev) => ({ ...prev, [id]: 'IN_PROGRESS' }));
    }
  };

  const handleSendMessage = (content: string, isNote: boolean) => {
    if (!activeCustomerId) return;
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderRole: isNote ? 'NOTE' : 'AGENT',
      content,
      timestamp: timeStr,
    };
    setMessages((prev) => ({
      ...prev,
      [activeCustomerId]: [...(prev[activeCustomerId] || []), newMsg],
    }));
  };

  const handleEndSession = () => {
    if (!activeCustomerId) return;
    const sysMsg: ChatMessage = {
      id: `sys-${Date.now()}`,
      senderRole: 'SYSTEM',
      content: '상담이 종료되었습니다.',
      timestamp: '',
    };
    setMessages((prev) => ({
      ...prev,
      [activeCustomerId]: [...(prev[activeCustomerId] || []), sysMsg],
    }));
    setStatuses((prev) => ({ ...prev, [activeCustomerId]: 'COMPLETED' }));
  };

  return (
    <DashboardLayout>
      <div className={styles.pageWrapper}>
        <div className={styles.mainArea}>
          {/* Left: Queue */}
          <QueuePanel
            customers={MOCK_CUSTOMERS}
            activeCustomerId={activeCustomerId}
            onSelectCustomer={handleSelectCustomer}
          />

          {/* Center: Chat */}
          <ChatPanel
            customerName={activeCustomer?.name || null}
            channel={activeCustomer?.channel || null}
            messages={activeMessages}
            onSendMessage={handleSendMessage}
          />

          {/* Right: Customer Info */}
          <CustomerInfoPanel
            customer={activeCustomer ? {
              name: activeCustomer.name,
              channel: activeCustomer.channel,
              handoffReason: activeCustomer.handoffReason,
              waitMinutes: activeCustomer.waitMinutes,
            } : null}
            memo={activeCustomerId ? (memos[activeCustomerId] || '') : ''}
            onMemoChange={(val) => {
              if (activeCustomerId) {
                setMemos((prev) => ({ ...prev, [activeCustomerId]: val }));
              }
            }}
          />
        </div>

        {/* Bottom: Status Bar */}
        <StatusBar
          status={activeCustomerId ? (statuses[activeCustomerId] || 'WAITING') : 'WAITING'}
          category={activeCustomerId ? (categories[activeCustomerId] || '') : ''}
          onStatusChange={(val) => {
            if (activeCustomerId) setStatuses((prev) => ({ ...prev, [activeCustomerId]: val }));
          }}
          onCategoryChange={(val) => {
            if (activeCustomerId) setCategories((prev) => ({ ...prev, [activeCustomerId]: val }));
          }}
          onEndSession={handleEndSession}
          disabled={!activeCustomerId}
        />
      </div>
    </DashboardLayout>
  );
};
