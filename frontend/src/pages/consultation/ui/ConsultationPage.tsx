import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ShellContext } from '@/pages/workspace/ui/WorkspaceLayout';
import { Dot, Mono, Pill, Avatar, Eyebrow, Icon } from '@/shared/ui/ostone/atoms';
import { QueuePanel } from '../../../features/consultation/ui/QueuePanel';
import type { QueueCustomer } from '../../../features/consultation/ui/QueuePanel';
import { ChatPanel } from '../../../features/consultation/ui/ChatPanel';
import type { ChatMessage as UiChatMessage } from '../../../features/consultation/ui/ChatPanel';
import { CustomerInfoPanel } from '../../../features/consultation/ui/CustomerInfoPanel';
import { StatusBar } from '../../../features/consultation/ui/StatusBar';
import { consultationApi } from '../../../features/consultation/api/consultationApi';
import { CustomerPanel } from './sections/CustomerPanel';

void CustomerInfoPanel;
void StatusBar;

const formatTime = (isoString: string) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const calcWaitMinutes = (isoString: string) => {
  if (!isoString) return 0;
  const d = new Date(isoString);
  const diffMs = new Date().getTime() - d.getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
};

const SUGGESTIONS = [
  '부분환불 가능합니다',
  '환불 처리 중입니다',
  '카드사 확인이 필요합니다',
];

const StatusRight = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Dot tone="signal" />
      <span style={{ fontSize: 12 }}>응대 가능</span>
    </div>
    <div style={{ width: 1, height: 16, background: 'var(--line)' }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Mono style={{ fontSize: 11, color: 'var(--ink-3)' }}>평균 첫응답</Mono>
      <span style={{ fontSize: 14, fontWeight: 700 }}>2분</span>
      <Mono style={{ fontSize: 11, color: 'var(--ink-3)' }}>14초</Mono>
    </div>
    <div style={{ width: 1, height: 16, background: 'var(--line)' }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Mono style={{ fontSize: 11, color: 'var(--ink-3)' }}>오늘 처리</Mono>
      <span style={{ fontSize: 14, fontWeight: 700 }}>14건</span>
    </div>
  </div>
);

export const ConsultationPage: React.FC = () => {
  const { setTopbarRight, setCrumbs } = useOutletContext<ShellContext>();
  const [queue, setQueue] = useState<QueueCustomer[]>([]);
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [memos, setMemos] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Record<string, string>>({});

  void categories;
  void setCategories;

  const activeCustomer = queue.find((c) => c.id === activeCustomerId) || null;

  useEffect(() => {
    setTopbarRight(<StatusRight />);
    setCrumbs(['CARD-CS', '실시간 상담']);
    return () => {
      setTopbarRight(undefined);
      setCrumbs([]);
    };
  }, [setTopbarRight, setCrumbs]);

  const loadQueue = useCallback(async () => {
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
          channel: s.channel ?? "",
          handoffReason: meta.handoffReason,
          waitMinutes: calcWaitMinutes(s.startedAt ?? ""),
          hasUnread: false,
        };
      });
      setQueue(formattedQueue);
    } catch (error) {
      console.error('Failed to load queue:', error);
    }
  }, []);

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 5000);
    return () => clearInterval(interval);
  }, [loadQueue]);

  useEffect(() => {
    if (!activeCustomerId) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    const loadMessages = async () => {
      try {
        const msgs = await consultationApi.getMessages(Number(activeCustomerId));
        if (cancelled) return;
        setMessages(msgs.map(m => ({
          id: String(m.id),
          senderRole: m.senderRole as UiChatMessage['senderRole'],
          content: m.content ?? "",
          timestamp: formatTime(m.createdAt ?? ""),
        })));
      } catch (error) {
        if (!cancelled) console.error('Failed to load messages:', error);
      }
    };

    loadMessages();
    const interval = setInterval(loadMessages, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeCustomerId]);

  const handleSelectCustomer = (id: string) => {
    setActiveCustomerId(id);
    if (!statuses[id]) {
      setStatuses((prev) => ({ ...prev, [id]: 'IN_PROGRESS' }));
    }
  };

  const handleSendMessage = async (content: string, isNote: boolean) => {
    if (!activeCustomerId) return;
    const targetId = activeCustomerId;
    try {
      const newMsg = await consultationApi.sendMessage(Number(targetId), content, isNote);
      setActiveCustomerId(current => {
        if (current === targetId) {
          setMessages(prev => [...prev, {
            id: String(newMsg.id),
            senderRole: newMsg.senderRole as UiChatMessage['senderRole'],
            content: newMsg.content ?? "",
            timestamp: formatTime(newMsg.createdAt ?? ""),
          }]);
        }
        return current;
      });
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
      loadQueue();
      setActiveCustomerId(null);
    } catch(err) {
      alert('세션 종료 실패');
    }
  };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: 268, flexShrink: 0, background: 'var(--paper-2)', overflow: 'auto' }}>
          <QueuePanel
            customers={queue}
            activeCustomerId={activeCustomerId}
            onSelectCustomer={handleSelectCustomer}
          />
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeCustomer && (
            <div style={{ flexShrink: 0, padding: '12px 16px', borderBottom: '1px solid var(--line-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar initial={activeCustomer.name.charAt(0)} tone="warn" size={36} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{activeCustomer.name} 고객</div>
                    <Mono style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                      {activeCustomer.channel ?? ""} · {activeCustomer.waitMinutes}분 대기 중
                    </Mono>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Eyebrow>AI가 분류한 주제</Eyebrow>
                  <Pill tone="signal">카드 환불 — 부분환불</Pill>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line-2)' }}>
                <button
                  style={{
                    fontSize: 12,
                    color: 'var(--ink-3)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  다른 상담사에게 넘기기
                </button>
                <button
                  onClick={handleEndSession}
                  style={{
                    fontSize: 12,
                    color: 'var(--danger)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    padding: 0,
                  }}
                >
                  상담 종료
                </button>
              </div>
            </div>
          )}

          <div style={{ flex: 1, overflow: 'auto' }}>
            <ChatPanel
              customerName={activeCustomer?.name || null}
              channel={activeCustomer?.channel || null}
              messages={messages}
              onSendMessage={handleSendMessage}
            />
          </div>

          {activeCustomer && (
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderTop: '1px solid var(--line-2)',
                background: 'var(--paper)',
              }}
            >
              <Icon name="spark" size={14} />
              <Mono style={{ fontSize: 10, color: 'var(--ink-3)' }}>추천 답변</Mono>
              {SUGGESTIONS.map((text) => (
                <button
                  key={text}
                  style={{
                    padding: '6px 14px',
                    fontSize: 12,
                    background: 'var(--paper-3)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--r-pill)',
                    cursor: 'pointer',
                    color: 'var(--ink)',
                  }}
                >
                  {text}
                </button>
              ))}
            </div>
          )}
        </div>

        <CustomerPanel
          customer={activeCustomer ? {
            name: activeCustomer.name,
            channel: activeCustomer.channel,
          } : null}
          memo={activeCustomerId ? (memos[activeCustomerId] || '') : ''}
          onMemoChange={(val) => {
            if (activeCustomerId) {
              setMemos((prev) => ({ ...prev, [activeCustomerId]: val }));
            }
          }}
        />
    </div>
  );
};
