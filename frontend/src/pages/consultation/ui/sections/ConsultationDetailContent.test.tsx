import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConsultationDetailContent } from "./ConsultationDetailContent";
import type { ConsultationDetailContentProps } from "./ConsultationDetailContent";
import type { ChatMessage as UiChatMessage } from "../../../../features/consultation/ui/ChatPanel";
import type { MatchedWorkflow } from "../../../../features/consultation/api/llmToolWorkflowApi";

vi.mock("../../../../features/consultation/ui/MessageDetailPanel", () => ({
  MessageDetailPanel: () => <div data-testid="message-detail-panel" />,
}));
vi.mock("./CustomerPanel", () => ({
  CustomerPanel: () => <div data-testid="customer-panel" />,
}));
vi.mock("./MatchedWorkflowBar", () => ({
  MatchedWorkflowBar: () => <div data-testid="matched-workflow-bar" />,
  MatchedWorkflowBarSkeleton: () => <div data-testid="matched-workflow-skeleton" />,
}));

const baseProps: ConsultationDetailContentProps = {
  activeCustomer: null,
  activeCustomerId: "c1",
  activeCustomerName: "김민서",
  selectedMessage: null,
  matchedWorkflow: null,
  isMatchedWorkflowLoading: false,
  isMessageDomainPackElementsLoading: false,
  messageDomainPackElementsError: null,
  memo: "",
  onMemoChange: () => {},
  onOpenDomainPackElement: () => {},
  onCloseMessageDetail: () => {},
};

describe("ConsultationDetailContent", () => {
  it("shows the customer panel when no message is selected", () => {
    render(<ConsultationDetailContent {...baseProps} />);
    expect(screen.getByTestId("customer-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("message-detail-panel")).not.toBeInTheDocument();
  });

  it("shows the message detail panel when a message is selected", () => {
    render(
      <ConsultationDetailContent {...baseProps} selectedMessage={{ id: "m1" } as UiChatMessage} />,
    );
    expect(screen.getByTestId("message-detail-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("customer-panel")).not.toBeInTheDocument();
  });

  it("renders the matched workflow bar when a workflow is present", () => {
    render(
      <ConsultationDetailContent
        {...baseProps}
        matchedWorkflow={{ workflowCode: "refund" } as unknown as MatchedWorkflow}
      />,
    );
    expect(screen.getByTestId("matched-workflow-bar")).toBeInTheDocument();
  });

  it("renders the matched workflow skeleton while loading", () => {
    render(<ConsultationDetailContent {...baseProps} isMatchedWorkflowLoading />);
    expect(screen.getByTestId("matched-workflow-skeleton")).toBeInTheDocument();
  });
});
