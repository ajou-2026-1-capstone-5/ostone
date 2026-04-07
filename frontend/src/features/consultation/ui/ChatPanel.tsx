import React, { useState, useRef, useEffect } from 'react';
import { Send, StickyNote, MessageSquare } from 'lucide-react';
import styles from './chat-panel.module.css';

export interface ChatMessage {
  id: string;
  senderRole: 'CUSTOMER' | 'AGENT' | 'SYSTEM' | 'NOTE';
  content: string;
  timestamp: string;
}

interface ChatPanelProps {
  customerName: string | null;
  channel: string | null;
  messages: ChatMessage[];
  onSendMessage: (content: string, isNote: boolean) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  customerName,
  channel,
  messages,
  onSendMessage,
}) => {
  const [input, setInput] = useState('');
  const [isNoteMode, setIsNoteMode] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim(), isNoteMode);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent triggering send while composing (e.g. Korean IME)
    if (e.nativeEvent.isComposing) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!customerName) {
    return (
      <div className={styles.chatWrapper}>
        <div className={styles.emptyChat}>
          <MessageSquare size={48} className={styles.emptyChatIcon} />
          <p className={styles.emptyChatText}>좌측 대기 목록에서 고객을 선택해주세요</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chatWrapper}>
      {/* Header */}
      <div className={styles.chatHeader}>
        <div className={styles.chatHeaderInfo}>
          <div className={styles.chatAvatar}>{customerName.charAt(0)}</div>
          <div>
            <div className={styles.chatCustomerName}>{customerName}</div>
            <div className={styles.chatChannel}>{channel}</div>
          </div>
        </div>
        <div className={styles.chatStatus}>
          <span className={styles.statusDot}></span>
          상담 진행중
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messageList} ref={listRef}>
        {messages.map((msg) => {
          if (msg.senderRole === 'SYSTEM') {
            return (
              <div key={msg.id} className={styles.systemMessage}>
                {msg.content}
              </div>
            );
          }
          if (msg.senderRole === 'NOTE') {
            return (
              <div key={msg.id} className={styles.internalNote}>
                <div className={styles.noteLabel}>📝 내부 메모</div>
                {msg.content}
              </div>
            );
          }
          const isAgent = msg.senderRole === 'AGENT';
          return (
            <div
              key={msg.id}
              className={`${styles.messageGroup} ${isAgent ? styles.messageGroupAgent : styles.messageGroupCustomer}`}
            >
              <div
                className={`${styles.msgAvatar} ${isAgent ? styles.msgAvatarAgent : styles.msgAvatarCustomer}`}
              >
                {isAgent ? 'A' : customerName.charAt(0)}
              </div>
              <div>
                <div
                  className={`${styles.msgBubble} ${isAgent ? styles.msgBubbleAgent : styles.msgBubbleCustomer}`}
                >
                  {msg.content}
                </div>
                <div className={`${styles.msgTime} ${isAgent ? styles.msgTimeAgent : ''}`}>
                  {msg.timestamp}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className={styles.inputArea}>
        <button
          className={`${styles.noteToggle} ${isNoteMode ? styles.noteToggleActive : ''}`}
          onClick={() => setIsNoteMode(!isNoteMode)}
          title={isNoteMode ? '일반 메시지로 전환' : '내부 메모 모드'}
        >
          <StickyNote size={18} />
        </button>
        <textarea
          className={styles.messageInput}
          rows={1}
          placeholder={isNoteMode ? '내부 메모를 입력하세요 (고객에게 보이지 않음)...' : '메시지를 입력하세요...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={!input.trim()}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};
