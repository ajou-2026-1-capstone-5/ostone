import React from "react";
import type { ChatMessage as UiChatMessage } from "../../../../features/consultation/ui/ChatPanel";
import { MessageDetailPanel } from "../../../../features/consultation/ui/MessageDetailPanel";
import type { MessageDomainPackElements } from "../../../../features/consultation/api/consultationEvidenceApi";
import type { MatchedWorkflow } from "../../../../features/consultation/api/llmToolWorkflowApi";
import { CustomerPanel, type CustomerExtractedInfo, type CustomerOrderInfo } from "./CustomerPanel";
import { MatchedWorkflowBar, MatchedWorkflowBarSkeleton } from "./MatchedWorkflowBar";
import type { QueueCustomerWithPanelData } from "../model/consultationPageState";
import styles from "../consultation-page.module.css";

export type ConsultationDetailContentProps = {
  activeCustomer: QueueCustomerWithPanelData | null;
  activeCustomerId: string | null;
  activeCustomerName: string;
  selectedMessage: UiChatMessage | null;
  matchedWorkflow: MatchedWorkflow | null;
  isMatchedWorkflowLoading: boolean;
  messageDomainPackElements?: MessageDomainPackElements;
  isMessageDomainPackElementsLoading: boolean;
  messageDomainPackElementsError: string | null;
  memo: string;
  onMemoChange: (value: string) => void;
  onMemoSave?: () => void;
  onOpenDomainPackElement: (path: string) => void;
  onCloseMessageDetail: () => void;
};

const getCustomerPanelData = (
  activeCustomer: QueueCustomerWithPanelData,
  activeCustomerName: string,
) => ({
  name: activeCustomerName,
  channel: activeCustomer.channel,
  handoffRequired: activeCustomer.handoffRequired,
  handoffReason: activeCustomer.handoffReason,
  handoffAt: activeCustomer.handoffAt,
  membershipTier: activeCustomer.customerInfo.membershipTier,
  contact: activeCustomer.customerInfo.contact,
  email: activeCustomer.customerInfo.email,
});

/**
 * 우측 컨텍스트의 본문(매칭 워크플로우 + 메시지 상세/고객 정보). `.detailPane`
 * wrapper 없이 본문만 렌더링하므로 데스크톱 인라인 컬럼과 좁은 화면 슬라이드오버가
 * 동일 컴포넌트를 공유한다 (#630).
 */
export const ConsultationDetailContent: React.FC<ConsultationDetailContentProps> = ({
  activeCustomer,
  activeCustomerId,
  activeCustomerName,
  selectedMessage,
  matchedWorkflow,
  isMatchedWorkflowLoading,
  messageDomainPackElements,
  isMessageDomainPackElementsLoading,
  messageDomainPackElementsError,
  memo,
  onMemoChange,
  onMemoSave,
  onOpenDomainPackElement,
  onCloseMessageDetail,
}) => {
  const orderInfo: CustomerOrderInfo | null = activeCustomer?.orderInfo ?? null;
  const extractedInfo: CustomerExtractedInfo | null = activeCustomer?.extractedInfo ?? null;

  return (
    <>
      {activeCustomerId && (isMatchedWorkflowLoading || matchedWorkflow) && (
        <div className={styles.detailPaneTop}>
          {matchedWorkflow ? (
            <MatchedWorkflowBar workflow={matchedWorkflow} />
          ) : (
            <MatchedWorkflowBarSkeleton />
          )}
        </div>
      )}
      <div className={styles.detailPaneBody}>
        {selectedMessage ? (
          <MessageDetailPanel
            message={selectedMessage}
            domainPackElements={messageDomainPackElements}
            isDomainPackElementsLoading={isMessageDomainPackElementsLoading}
            domainPackElementsError={messageDomainPackElementsError}
            onOpenDomainPackElement={onOpenDomainPackElement}
            onClose={onCloseMessageDetail}
          />
        ) : (
          <CustomerPanel
            customer={
              activeCustomer ? getCustomerPanelData(activeCustomer, activeCustomerName) : null
            }
            orderInfo={orderInfo}
            extractedInfo={extractedInfo}
            memo={memo}
            onMemoChange={onMemoChange}
            onMemoSave={onMemoSave}
          />
        )}
      </div>
    </>
  );
};
