import React, { useState, useRef, useLayoutEffect, useCallback } from "react";
import { Send, StickyNote, MessageSquare, WandSparkles } from "lucide-react";
import {
  getChatRolePresentation,
  isCounselorLikeRole,
  type ChatSenderRole,
} from "../lib/chatRoleLabels";
import styles from "./chat-panel.module.css";

export type MessageDeliveryStatus = "sending" | "sent" | "failed";

export interface ChatMessage {
  id: string;
  seqNo?: number;
  /** 서버 확정 순서 정렬용 raw ISO 타임스탬프. 표시에는 `timestamp`를 사용한다. */
  createdAt?: string;
  senderRole: ChatSenderRole;
  content: string;
  timestamp: string;
  deliveryStatus?: MessageDeliveryStatus;
  retryable?: boolean;
  errorMessage?: string;
}

export interface ChatComposerDraft {
  input: string;
  isNoteMode: boolean;
}

interface ChatPanelProps {
  sessionId?: string | null;
  customerName: string | null;
  channel: string | null;
  messages: ChatMessage[];
  onSendMessage: (content: string, isNote: boolean) => void;
  onRetryMessage?: (messageId: string) => void;
  selectedMessageId: string | null;
  onSelectMessage: (messageId: string | null) => void;
  sessionStatusLabel?: string;
  sessionStatusDescription?: string;
  disabled?: boolean;
  disabledReason?: string;
  hasPreviousMessages?: boolean;
  isLoadingPreviousMessages?: boolean;
  onLoadPreviousMessages?: () => Promise<void>;
  draftResponseAction?: {
    isLoading: boolean;
    onInsert: () => Promise<string>;
  };
  composerDraft?: ChatComposerDraft;
  onComposerDraftChange?: (draft: ChatComposerDraft) => void;
}

const BOTTOM_SCROLL_THRESHOLD_PX = 96;

const isNearBottom = (element: HTMLDivElement) =>
  element.scrollHeight - element.scrollTop - element.clientHeight <= BOTTOM_SCROLL_THRESHOLD_PX;

type MessageScrollState = {
  sessionKey: string | null | undefined;
  messageCount: number;
  wasNearBottom: boolean;
  showNewMessageNotice: boolean;
  scrollRequestId: number;
  shouldScrollToBottom: boolean;
};

/**
 * 상담 대화 내용을 표시하고 메시지를 전송하는 패널 컴포넌트입니다.
 * 실시간 메시지 렌더링, 전송 시 스크롤 관리, 한글 입력 최적화 등을 처리합니다.
 *
 * @param props - 메시지 목록 및 전송 핸들러
 * @returns 채팅 패널 컴포넌트
 */
export const ChatPanel: React.FC<ChatPanelProps> = ({
  sessionId,
  customerName,
  channel,
  messages,
  onSendMessage,
  onRetryMessage,
  selectedMessageId,
  onSelectMessage,
  sessionStatusLabel,
  sessionStatusDescription,
  disabled = false,
  disabledReason,
  hasPreviousMessages = false,
  isLoadingPreviousMessages = false,
  onLoadPreviousMessages,
  draftResponseAction,
  composerDraft,
  onComposerDraftChange,
}) => {
  const [uncontrolledDraft, setUncontrolledDraft] = useState<ChatComposerDraft>({
    input: "",
    isNoteMode: false,
  });
  const listRef = useRef<HTMLDivElement>(null);
  const previousScrollHeightRef = useRef<number | null>(null);
  const customerInitial = customerName?.trim().charAt(0) || "?";
  const sessionKey = sessionId ?? customerName;
  const activeDraft = composerDraft ?? uncontrolledDraft;
  const setActiveDraft = (nextDraft: ChatComposerDraft) => {
    if (!composerDraft) {
      setUncontrolledDraft(nextDraft);
    }
    onComposerDraftChange?.(nextDraft);
  };
  const [scrollState, setScrollState] = useState<MessageScrollState>(() => ({
    sessionKey,
    messageCount: messages.length,
    wasNearBottom: true,
    showNewMessageNotice: false,
    scrollRequestId: customerName && messages.length > 0 ? 1 : 0,
    shouldScrollToBottom: Boolean(customerName && messages.length > 0),
  }));

  if (scrollState.sessionKey !== sessionKey || scrollState.messageCount !== messages.length) {
    const hasSessionChanged = scrollState.sessionKey !== sessionKey;
    const hasInitialMessages = scrollState.messageCount === 0 && messages.length > 0;
    const hasMessageCountDecreased = messages.length < scrollState.messageCount;
    const hasNewMessages = messages.length > scrollState.messageCount;
    const shouldScrollToBottom = Boolean(
      customerName &&
      (hasSessionChanged ||
        hasInitialMessages ||
        hasMessageCountDecreased ||
        (hasNewMessages && scrollState.wasNearBottom)),
    );
    const shouldShowNewMessageNotice = Boolean(
      customerName &&
      hasNewMessages &&
      !scrollState.wasNearBottom &&
      !hasSessionChanged &&
      !hasInitialMessages &&
      !hasMessageCountDecreased,
    );

    setScrollState({
      sessionKey,
      messageCount: messages.length,
      wasNearBottom: shouldScrollToBottom ? true : scrollState.wasNearBottom,
      showNewMessageNotice: shouldShowNewMessageNotice,
      scrollRequestId: shouldScrollToBottom
        ? scrollState.scrollRequestId + 1
        : scrollState.scrollRequestId,
      shouldScrollToBottom,
    });
  }

  const showNewMessageNotice = scrollState.showNewMessageNotice;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const messageList = listRef.current;
    if (!messageList) return;

    if (typeof messageList.scrollTo === "function") {
      messageList.scrollTo({ top: messageList.scrollHeight, behavior });
    } else {
      messageList.scrollTop = messageList.scrollHeight;
    }
  }, []);

  useLayoutEffect(() => {
    const previousScrollHeight = previousScrollHeightRef.current;
    const messageList = listRef.current;
    if (previousScrollHeight !== null && messageList) {
      messageList.scrollTop += messageList.scrollHeight - previousScrollHeight;
      previousScrollHeightRef.current = null;
      return;
    }

    if (scrollState.shouldScrollToBottom) {
      scrollToBottom();
    }
  }, [messages, scrollState.scrollRequestId, scrollState.shouldScrollToBottom, scrollToBottom]);

  const handleMessageListScroll = () => {
    const messageList = listRef.current;
    if (!messageList) return;

    const nextIsNearBottom = isNearBottom(messageList);
    setScrollState((current) => {
      if (current.wasNearBottom === nextIsNearBottom && !current.showNewMessageNotice) {
        return current;
      }

      return {
        ...current,
        wasNearBottom: nextIsNearBottom,
        showNewMessageNotice: nextIsNearBottom ? false : current.showNewMessageNotice,
        shouldScrollToBottom: false,
      };
    });
  };

  const handleNewMessageClick = () => {
    scrollToBottom("smooth");
    setScrollState((current) => ({
      ...current,
      wasNearBottom: true,
      showNewMessageNotice: false,
      shouldScrollToBottom: false,
    }));
  };

  const handleLoadPreviousMessages = async () => {
    if (!onLoadPreviousMessages || isLoadingPreviousMessages) return;
    previousScrollHeightRef.current = listRef.current?.scrollHeight ?? null;
    try {
      await onLoadPreviousMessages();
    } catch {
      previousScrollHeightRef.current = null;
    }
  };

  const handleInsertDraft = async () => {
    if (disabled || !draftResponseAction || draftResponseAction.isLoading) return;
    try {
      const draft = await draftResponseAction.onInsert();
      if (draft.trim()) {
        setActiveDraft({ input: draft, isNoteMode: false });
      }
    } catch {
      // The page-level handler owns user-facing error feedback and the existing input is preserved.
    }
  };

  /**
   * 메시지 전송 버튼 클릭 또는 엔터 키 입력 시 호출되는 핸들러입니다.
   * 공백 검사 및 한글 IME 입력 충돌 방지 로직을 포함합니다.
   */
  const handleSend = () => {
    if (disabled || !activeDraft.input.trim()) return;
    onSendMessage(activeDraft.input.trim(), activeDraft.isNoteMode);
    setActiveDraft({ ...activeDraft, input: "" });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderDeliveryMeta = (msg: ChatMessage, isAgent = false) => {
    if (msg.deliveryStatus === "sending") {
      return (
        <div className={`${styles.deliveryMeta} ${isAgent ? styles.deliveryMetaAgent : ""}`}>
          전송 중
        </div>
      );
    }

    if (msg.deliveryStatus !== "failed") return null;

    return (
      <div
        className={`${styles.deliveryMeta} ${styles.deliveryMetaFailed} ${isAgent ? styles.deliveryMetaAgent : ""}`}
      >
        <span title={msg.errorMessage}>전송 실패</span>
        {msg.retryable && onRetryMessage ? (
          <button
            type="button"
            className={styles.retryButton}
            onClick={(event) => {
              event.stopPropagation();
              onRetryMessage(msg.id);
            }}
          >
            다시 보내기
          </button>
        ) : null}
      </div>
    );
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
          <div className={styles.chatAvatar}>{customerInitial}</div>
          <div>
            <div className={styles.chatCustomerName}>{customerName}</div>
            <div className={styles.chatChannel}>{channel}</div>
          </div>
        </div>
        <div className={styles.chatStatus} data-testid="chat-assignment-status">
          <span className={styles.statusDot}></span>
          <div className={styles.statusCopy}>
            <span>{sessionStatusLabel ?? "상담 진행중"}</span>
            {sessionStatusDescription && <small>{sessionStatusDescription}</small>}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messageListShell}>
        <div
          className={styles.messageList}
          ref={listRef}
          onScroll={handleMessageListScroll}
          data-testid="chat-message-list"
        >
          {hasPreviousMessages && (
            <button
              type="button"
              className={styles.loadPreviousButton}
              onClick={() => void handleLoadPreviousMessages()}
              disabled={isLoadingPreviousMessages}
            >
              {isLoadingPreviousMessages ? "불러오는 중..." : "이전 메시지 불러오기"}
            </button>
          )}
          {messages.map((msg) => {
            if (msg.senderRole === "SYSTEM") {
              const role = getChatRolePresentation(msg.senderRole);
              return (
                <div key={msg.id} className={styles.systemMessage}>
                  <span className={styles.systemLabel}>{role.label}</span>
                  <span>{msg.content}</span>
                </div>
              );
            }
            if (msg.senderRole === "NOTE") {
              const role = getChatRolePresentation(msg.senderRole);
              return (
                <div
                  key={msg.id}
                  className={`${styles.internalNote} ${msg.deliveryStatus === "sending" ? styles.internalNoteSending : ""} ${msg.deliveryStatus === "failed" ? styles.internalNoteFailed : ""}`}
                >
                  <div className={styles.noteLabel}>{role.label}</div>
                  {msg.content}
                  {renderDeliveryMeta(msg, true)}
                </div>
              );
            }
            const role = getChatRolePresentation(msg.senderRole);
            const isAgent = isCounselorLikeRole(msg.senderRole);
            const isSelected = selectedMessageId === msg.id;
            return (
              <div
                key={msg.id}
                className={`${styles.messageGroup} ${isAgent ? styles.messageGroupAgent : styles.messageGroupCustomer} ${isSelected ? styles.messageSelected : ""}`}
                onClick={() => {
                  if (isSelected) {
                    onSelectMessage(null);
                  } else {
                    onSelectMessage(msg.id);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (isSelected) {
                      onSelectMessage(null);
                    } else {
                      onSelectMessage(msg.id);
                    }
                  }
                }}
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
              >
                <div
                  className={`${styles.msgAvatar} ${isAgent ? styles.msgAvatarAgent : styles.msgAvatarCustomer}`}
                >
                  {isAgent ? role.avatar : customerInitial}
                </div>
                <div>
                  <div
                    className={`${styles.msgBubble} ${isAgent ? styles.msgBubbleAgent : styles.msgBubbleCustomer} ${msg.deliveryStatus === "sending" ? styles.msgBubbleSending : ""} ${msg.deliveryStatus === "failed" ? styles.msgBubbleFailed : ""}`}
                  >
                    {msg.content}
                  </div>
                  <div className={`${styles.msgTime} ${isAgent ? styles.msgTimeAgent : ""}`}>
                    <span>{role.label} · </span>
                    {msg.timestamp}
                  </div>
                  {renderDeliveryMeta(msg, isAgent)}
                </div>
              </div>
            );
          })}
        </div>
        {showNewMessageNotice && (
          <button type="button" className={styles.newMessageButton} onClick={handleNewMessageClick}>
            새 메시지 보기
          </button>
        )}
      </div>

      {disabled && disabledReason && (
        <output className={styles.disabledNotice}>{disabledReason}</output>
      )}

      {/* Input */}
      <div className={styles.inputArea}>
        <button
          className={`${styles.noteToggle} ${activeDraft.isNoteMode ? styles.noteToggleActive : ""}`}
          onClick={() => setActiveDraft({ ...activeDraft, isNoteMode: !activeDraft.isNoteMode })}
          disabled={disabled}
          title={activeDraft.isNoteMode ? "일반 메시지로 전환" : "내부 메모로 남기기"}
        >
          <StickyNote size={18} />
        </button>
        {draftResponseAction && (
          <button
            type="button"
            className={styles.draftInsertButton}
            onClick={() => void handleInsertDraft()}
            disabled={disabled || draftResponseAction.isLoading}
            aria-label="답변 초안 삽입"
            title="답변 초안 삽입"
            data-testid="insert-draft-response"
          >
            <WandSparkles size={18} />
          </button>
        )}
        <textarea
          className={styles.messageInput}
          rows={1}
          placeholder={
            activeDraft.isNoteMode
              ? "내부 메모로 타임라인에 남길 내용을 입력하세요..."
              : "메시지를 입력하세요..."
          }
          value={activeDraft.input}
          onChange={(e) => setActiveDraft({ ...activeDraft, input: e.target.value })}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={disabled || !activeDraft.input.trim()}
          aria-label={activeDraft.isNoteMode ? "내부 메모 남기기" : "메시지 전송"}
          title={activeDraft.isNoteMode ? "내부 메모로 남기기" : "메시지 전송"}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};
