import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../shared/ui/layout/DashboardLayout';
import { QueuePanel } from '../../../features/consultation/ui/QueuePanel';
import type { QueueCustomer } from '../../../features/consultation/ui/QueuePanel';
import { ChatPanel } from '../../../features/consultation/ui/ChatPanel';
import type { ChatMessage as UiChatMessage } from '../../../features/consultation/ui/ChatPanel';
import { CustomerInfoPanel } from '../../../features/consultation/ui/CustomerInfoPanel';
import { StatusBar } from '../../../features/consultation/ui/StatusBar';
import styles from './consultation-page.module.css';
import { consultationApi } from '../../../features/consultation/api/consultationApi';

// Helper to format ISO time to HH:mm
const formatTime = (isoString: string) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

// Helper to calculate wait minutes
const calcWaitMinutes = (isoString: string) => {
  if (!isoString) return 0;
  const d = new Date(isoString);
  const diffMs = new Date().getTime() - d.getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
};

export const ConsultationPage: React.FC = () => {
  const [queue, setQueue] = useState<QueueCustomer[]>([]);
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [memos, setMemos] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Record<string, string>>({});

  const activeCustomer = queue.find((c) => c.id === activeCustomerId) || null;

  // Load Queue
  const loadQueue = async () => {
    try {
      const sessions = await consultationApi.getQueue();
      const formattedQueue = sessions.map((s) => {
        let meta = { customerName: 'Unknown', handoffReason: '' };
        try {
          if (s.metaJson) meta = JSON.parse(s.metaJson);
        } catch (e) {
          console.error('Failed to parse metaJson', e);
        }
        return {
          id: String(s.id),
          name: meta.customerName,
          channel: s.channel,
          handoffReason: meta.handoffReason,
          waitMinutes: calcWaitMinutes(s.startedAt),
          hasUnread: false,
        };
      });
      setQueue(formattedQueue);
    } catch (error) {
      console.error('Failed to load queue:', error);
    }
  };

  useEffect(() => {
    loadQueue();
    // 주기적으로 폴링(polling)하면 실시간성 확보 가능
    // const interval = setInterval(loadQueue, 5000);
    // return () => clearInterval(interval);
  }, []);

  // Load Messages on select
  useEffect(() => {
    if (!activeCustomerId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      try {
        const msgs = await consultationApi.getMessages(Number(activeCustomerId));
        setMessages(msgs.map(m => ({
          id: String(m.id),
          senderRole: m.senderRole as any,
          content: m.content,
          timestamp: formatTime(m.createdAt),
        })));
      } catch (error) {
        console.error('Failed to load messages:', error);
      }
    };

    loadMessages();
  }, [activeCustomerId]);

  const handleSelectCustomer = (id: string) => {
    setActiveCustomerId(id);
    if (!statuses[id]) {
      setStatuses((prev) => ({ ...prev, [id]: 'IN_PROGRESS' }));
    }
  };

  const handleSendMessage = async (content: string, isNote: boolean) => {
    if (!activeCustomerId) return;
    try {
      const newMsg = await consultationApi.sendMessage(Number(activeCustomerId), content, isNote);
      setMessages(prev => [...prev, {
        id: String(newMsg.id),
        senderRole: newMsg.senderRole as any,
        content: newMsg.content,
        timestamp: formatTime(newMsg.createdAt),
      }]);
    } catch(err) {
      alert('메시지 전송 실패');
    }
  };

  const handleEndSession = async () => {
    if (!activeCustomerId) return;
    try {
      await consultationApi.updateStatus(Number(activeCustomerId), 'COMPLETED');
      setStatuses((prev) => ({ ...prev, [activeCustomerId]: 'COMPLETED' }));
      alert('상담이 종료되었습니다.');
      // 큐 목록 재조회 (상태가 OPEN인 것만 가져오므로, 종료된 것은 리스트에서 사라짐)
      loadQueue();
      setActiveCustomerId(null);
    } catch(err) {
      alert('세션 종료 실패');
    }
  };

  return (
    <DashboardLayout>
      <div className={styles.pageWrapper}>
        <div className={styles.mainArea}>
          {/* Left: Queue */}
          <QueuePanel
            customers={queue}
            activeCustomerId={activeCustomerId}
            onSelectCustomer={handleSelectCustomer}
          />

          {/* Center: Chat */}
          <ChatPanel
            customerName={activeCustomer?.name || null}
            channel={activeCustomer?.channel || null}
            messages={messages}
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
