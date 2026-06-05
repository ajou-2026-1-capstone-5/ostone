import React from "react";
import type { ChatMessage as UiChatMessage } from "../../../../features/consultation/ui/ChatPanel";
import { MessageDetailPanel } from "../../../../features/consultation/ui/MessageDetailPanel";
import type { MessageDomainPackElements } from "../../../../features/consultation/api/consultationEvidenceApi";
import type { MatchedWorkflow } from "../../../../features/consultation/api/llmToolWorkflowApi";
import {
  CustomerPanel,
  type CustomerExtractedInfo,
  type CustomerOrderInfo,
} from "./CustomerPanel";
import { MatchedWorkflowBar, MatchedWorkflowBarSkeleton } from "./MatchedWorkflowBar";
import type { QueueCustomerWithPanelData } from "../model/consultationPageState";
import styles from "../consultation-page.module.css";

type ConsultationDetailPaneProps = {
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

export const ConsultationDetailPane: React.FC<ConsultationDetailPaneProps> = ({
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
    <div className={styles.detailPane}>
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
    </div>
  );
};
