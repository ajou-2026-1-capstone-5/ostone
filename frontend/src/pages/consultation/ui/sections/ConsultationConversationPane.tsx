import React from "react";
import { Avatar, Mono } from "@/shared/ui/ostone/atoms";
import { formatWaitDuration } from "../../../../features/consultation/lib/formatWaitDuration";
import { ChatPanel } from "../../../../features/consultation/ui/ChatPanel";
import type {
  ChatComposerDraft,
  ChatMessage as UiChatMessage,
} from "../../../../features/consultation/ui/ChatPanel";
import type { MatchedWorkflow } from "../../../../features/consultation/api/llmToolWorkflowApi";
import type {
  AssignmentView,
  MessagePaginationState,
  QueueCustomerWithPanelData,
} from "../model/consultationPageState";
import styles from "../consultation-page.module.css";

type ConsultationConversationPaneProps = {
  activeCustomer: QueueCustomerWithPanelData | null;
  activeCustomerId: string | null;
  activeCustomerName: string;
  activeCustomerInitial: string;
  activeResponseStatusLabel: string | null;
  activeAssignment: AssignmentView | null;
  currentCounselorId: number | null;
  isActiveSessionUnassigned: boolean;
  isActiveSessionClosed: boolean;
  isClaimingActiveSession: boolean;
  isAssignedToCurrentCounselor: boolean;
  messageInputDisabledReason?: string;
  urlSessionUnavailable: boolean;
  visibleMessages: UiChatMessage[];
  selectedMessageId: string | null;
  hasPreviousMessages: boolean;
  messagePagination: MessagePaginationState;
  matchedWorkflow: MatchedWorkflow | null;
  isDraftResponseLoading: boolean;
  activeComposerDraft: ChatComposerDraft;
  onClaimSession: () => void;
  onOpenReleaseAssignment: () => void;
  onOpenEndSession: () => void;
  onSendMessage: (content: string, isNote: boolean) => void;
  onRetryMessage: (messageId: string) => void;
  onSelectMessage: (messageId: string | null) => void;
  onLoadPreviousMessages: () => Promise<void>;
  onInsertDraftResponse: () => Promise<string>;
  onComposerDraftChange: (draft: ChatComposerDraft) => void;
};

export const ConsultationConversationPane: React.FC<ConsultationConversationPaneProps> = ({
  activeCustomer,
  activeCustomerId,
  activeCustomerName,
  activeCustomerInitial,
  activeResponseStatusLabel,
  activeAssignment,
  currentCounselorId,
  isActiveSessionUnassigned,
  isActiveSessionClosed,
  isClaimingActiveSession,
  isAssignedToCurrentCounselor,
  messageInputDisabledReason,
  urlSessionUnavailable,
  visibleMessages,
  selectedMessageId,
  hasPreviousMessages,
  messagePagination,
  matchedWorkflow,
  isDraftResponseLoading,
  activeComposerDraft,
  onClaimSession,
  onOpenReleaseAssignment,
  onOpenEndSession,
  onSendMessage,
  onRetryMessage,
  onSelectMessage,
  onLoadPreviousMessages,
  onInsertDraftResponse,
  onComposerDraftChange,
}) => {
  return (
    <div className={styles.conversationPane}>
      {activeCustomer && (
        <div className={styles.conversationHeader}>
          <div className={styles.conversationHeaderTop}>
            <div className={styles.customerTitle}>
              <Avatar initial={activeCustomerInitial} tone="warn" size={36} />
              <div>
                <div className={styles.customerName}>{activeCustomerName} 고객</div>
                <Mono style={{ fontSize: 10, color: "var(--ink-3)" }}>
                  {activeCustomer.channel ?? ""} ·{" "}
                  {formatWaitDuration(activeCustomer.waitMinutes)} 대기 중
                </Mono>
              </div>
            </div>
          </div>
          <div className={styles.conversationActions}>
            {activeResponseStatusLabel && (
              <div
                className={styles.responseStatusBadge}
                role="status"
                aria-label="응대 상태"
                data-testid="conversation-response-status"
              >
                {activeResponseStatusLabel}
              </div>
            )}
            {isActiveSessionUnassigned && !isActiveSessionClosed && (
              <button
                type="button"
                className={styles.claimButton}
                onClick={onClaimSession}
                disabled={!currentCounselorId || isClaimingActiveSession}
              >
                {isClaimingActiveSession ? "배정 중..." : "배정받기"}
              </button>
            )}
            <button
              className={styles.linkButton}
              onClick={onOpenReleaseAssignment}
              disabled={!isAssignedToCurrentCounselor}
            >
              배정 해제
            </button>
            <button
              onClick={onOpenEndSession}
              className={styles.dangerButton}
              disabled={!isAssignedToCurrentCounselor}
            >
              상담 종료
            </button>
          </div>
        </div>
      )}

      <div className={styles.chatPanelSlot}>
        {urlSessionUnavailable ? (
          <div className={styles.urlSessionState} role="status" aria-live="polite">
            <p className={styles.urlSessionTitle}>요청한 상담 세션을 찾을 수 없습니다</p>
            <p className={styles.urlSessionText}>
              상담이 종료되었거나 현재 대기열에서 접근할 수 없는 세션입니다.
            </p>
          </div>
        ) : (
          <ChatPanel
            sessionId={activeCustomerId}
            customerName={activeCustomer ? activeCustomerName : null}
            channel={activeCustomer?.channel || null}
            messages={visibleMessages}
            onSendMessage={onSendMessage}
            onRetryMessage={onRetryMessage}
            selectedMessageId={selectedMessageId}
            onSelectMessage={onSelectMessage}
            sessionStatusLabel={activeResponseStatusLabel ?? activeAssignment?.label}
            disabledReason={messageInputDisabledReason}
            disabled={!isAssignedToCurrentCounselor}
            hasPreviousMessages={hasPreviousMessages}
            isLoadingPreviousMessages={messagePagination.isLoadingPrevious}
            onLoadPreviousMessages={onLoadPreviousMessages}
            draftResponseAction={
              matchedWorkflow && isAssignedToCurrentCounselor
                ? {
                    isLoading: isDraftResponseLoading,
                    onInsert: onInsertDraftResponse,
                  }
                : undefined
            }
            composerDraft={activeComposerDraft}
            onComposerDraftChange={onComposerDraftChange}
          />
        )}
      </div>
    </div>
  );
};
