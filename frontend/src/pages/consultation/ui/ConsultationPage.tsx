import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { AppShell } from '@/widgets/app-shell';
import { QueuePanel } from '../../../features/consultation/ui/QueuePanel';
import type { QueueCustomer } from '../../../features/consultation/ui/QueuePanel';
import { ChatPanel } from '../../../features/consultation/ui/ChatPanel';
import type { ChatMessage as UiChatMessage } from '../../../features/consultation/ui/ChatPanel';
import { CustomerInfoPanel } from '../../../features/consultation/ui/CustomerInfoPanel';
import { StatusBar } from '../../../features/consultation/ui/StatusBar';
import { Dot } from '@/shared/ui/atoms/Dot';
import { Mono } from '@/shared/ui/atoms/Mono';
import { consultationApi } from '../../../features/consultation/api/consultationApi';

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

export const ConsultationPage: React.FC = () => {
  const [queue, setQueue] = useState<QueueCustomer[]>([]);
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [memos, setMemos] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [filterTab, setFilterTab] = useState<'all' | 'urgent' | 'mine'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);

  const activeCustomer = queue.find((c) => c.id === activeCustomerId) || null;

  const loadQueue = useCallback(async () => {
    setIsLoadingQueue(true);
    try {
      const sessions = await consultationApi.getQueue();
      const formattedQueue = sessions.map((s) => {
        let meta: Record<string, unknown> = { customerName: 'Unknown', handoffReason: '' };
        try {
          if (s.metaJson) meta = JSON.parse(s.metaJson) as Record<string, unknown>;
        } catch (e) {
          console.error('Failed to parse metaJson', e);
        }
        const waitMinutes = calcWaitMinutes(s.startedAt);
        return {
          id: String(s.id),
          name: String(meta.customerName || 'Unknown'),
          channel: s.channel,
          handoffReason: String(meta.handoffReason || ''),
          waitMinutes,
          hasUnread: false,
          topic: String(meta.topic || meta.handoffReason || '미분류'),
          urgent: waitMinutes > 5 || meta.urgent === true,
        };
      });
      setQueue(formattedQueue);
    } catch (error) {
      console.error('Failed to load queue:', error);
      toast.error('대기열을 불러오는 데 실패했습니다.');
    } finally {
      setIsLoadingQueue(false);
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
          content: m.content,
          timestamp: formatTime(m.createdAt),
          isHandoff: m.senderRole === 'SYSTEM' && /연결|핸드오프|handoff|transfer/i.test(m.content),
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
      setActiveCustomerId((current) => {
        if (current === targetId) {
          setMessages((prev) => [...prev, {
            id: String(newMsg.id),
            senderRole: newMsg.senderRole as UiChatMessage['senderRole'],
            content: newMsg.content,
            timestamp: formatTime(newMsg.createdAt),
          }]);
        }
        return current;
      });
    } catch (err) {
      toast.error('메시지 전송 실패');
    }
  };

  const handleEndSession = async () => {
    if (!activeCustomerId) return;
    try {
      await consultationApi.updateStatus(Number(activeCustomerId), 'COMPLETED');
      setStatuses((prev) => ({ ...prev, [activeCustomerId]: 'COMPLETED' }));
      toast.success('상담이 종료되었습니다.');
      loadQueue();
      setActiveCustomerId(null);
    } catch (err) {
      toast.error('세션 종료 실패');
    }
  };

  const filteredQueue = useMemo(() => {
    let result = queue;
    if (filterTab === 'urgent') {
      result = result.filter((c) => c.urgent);
    } else if (filterTab === 'mine') {
      result = result.filter((c) => statuses[c.id] === 'IN_PROGRESS');
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((c) =>
        c.name.toLowerCase().includes(q) || (c.topic || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [queue, filterTab, searchQuery, statuses]);

  return (
    <AppShell
      activeNav="msg"
      crumbs={['CARD-CS', 'Consultation']}
      topbarRight={
        <div className="flex items-center gap-3.5 text-xs">
          <div className="flex items-center gap-1.5 text-[var(--ink-2)]">
            <Dot tone="signal" /> <span className="font-medium">응대 가능</span>
          </div>
          <div className="w-px h-3.5 bg-[var(--line)]" />
          <div className="text-[var(--ink-3)]">
            평균 첫응답 <Mono className="text-[var(--ink)] font-medium">2분 14초</Mono>
          </div>
          <div className="text-[var(--ink-3)]">
            오늘 처리 <Mono className="text-[var(--ink)] font-medium">14건</Mono>
          </div>
        </div>
      }
    >
      <div className="flex flex-col flex-1 min-h-0 h-full">
        <div className="flex flex-1 min-h-0">
          <PanelGroup orientation="horizontal">
            <Panel defaultSize={20} minSize={15} maxSize={30}>
              <QueuePanel
                customers={filteredQueue}
                activeCustomerId={activeCustomerId}
                onSelectCustomer={handleSelectCustomer}
                filterTab={filterTab}
                onFilterChange={setFilterTab}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                isLoading={isLoadingQueue}
              />
            </Panel>
            <PanelResizeHandle className="w-1 bg-[var(--line)] hover:bg-[var(--ink-3)] transition-colors" />
            <Panel defaultSize={55}>
              <ChatPanel
                customerName={activeCustomer?.name || null}
                channel={activeCustomer?.channel || null}
                messages={messages}
                onSendMessage={handleSendMessage}
              />
            </Panel>
            <PanelResizeHandle className="w-1 bg-[var(--line)] hover:bg-[var(--ink-3)] transition-colors" />
            <Panel defaultSize={25} minSize={20} maxSize={35}>
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
            </Panel>
          </PanelGroup>
        </div>

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
    </AppShell>
  );
};
