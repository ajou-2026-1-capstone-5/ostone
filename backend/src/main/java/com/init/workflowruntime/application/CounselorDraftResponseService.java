package com.init.workflowruntime.application;

import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.command.GenerateDraftResponseCommand;
import com.init.workflowruntime.application.dto.GenerateWorkflowAwareResponseResult;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.WorkflowExecution;
import com.init.workflowruntime.domain.WorkflowExecutionRepository;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CounselorDraftResponseService {

  private final ChatSessionRepository chatSessionRepository;
  private final ChatMessageRepository chatMessageRepository;
  private final WorkflowExecutionRepository workflowExecutionRepository;
  private final WorkflowDefinitionRepository workflowDefinitionRepository;
  private final LlmAssistantService llmAssistantService;

  public CounselorDraftResponseService(
      ChatSessionRepository chatSessionRepository,
      ChatMessageRepository chatMessageRepository,
      WorkflowExecutionRepository workflowExecutionRepository,
      WorkflowDefinitionRepository workflowDefinitionRepository,
      LlmAssistantService llmAssistantService) {
    this.chatSessionRepository = chatSessionRepository;
    this.chatMessageRepository = chatMessageRepository;
    this.workflowExecutionRepository = workflowExecutionRepository;
    this.workflowDefinitionRepository = workflowDefinitionRepository;
    this.llmAssistantService = llmAssistantService;
  }

  public GenerateWorkflowAwareResponseResult generateDraft(GenerateDraftResponseCommand command) {
    ChatSession session =
        chatSessionRepository
            .findById(command.sessionId())
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "SESSION_NOT_FOUND", "Session not found: " + command.sessionId()));
    WorkflowExecution execution =
        workflowExecutionRepository
            .findTopByChatSessionIdOrderByStartedAtDescIdDesc(command.sessionId())
            .orElse(null);
    WorkflowDefinition workflow = resolveWorkflow(command.sessionId(), session, execution);

    List<ChatMessage> recentMessages =
        new ArrayList<>(
            chatMessageRepository.findTop5ByChatSessionIdOrderBySeqNoDesc(command.sessionId()));
    Collections.reverse(recentMessages);
    String conversationContext =
        recentMessages.stream()
            .map(message -> message.getSenderRole() + ": " + nullToEmpty(message.getContent()))
            .collect(Collectors.joining("\n"));
    String latestCustomerMessage = latestCustomerMessage(recentMessages);

    return llmAssistantService.generateCounselorDraftResponse(
        workflowSummary(workflow),
        execution != null ? execution.getCurrentState() : workflow.getInitialState(),
        conversationContext,
        latestCustomerMessage);
  }

  private WorkflowDefinition resolveWorkflow(
      Long sessionId, ChatSession session, WorkflowExecution execution) {
    if (execution != null && execution.getWorkflowDefinitionId() != null) {
      return workflowDefinitionRepository
          .findByIdAndDomainPackVersionId(
              execution.getWorkflowDefinitionId(), session.getDomainPackVersionId())
          .orElseThrow(() -> matchedWorkflowMissing(sessionId));
    }

    return workflowDefinitionRepository
        .findAllByDomainPackVersionId(session.getDomainPackVersionId())
        .stream()
        .findFirst()
        .orElseThrow(() -> matchedWorkflowMissing(sessionId));
  }

  private BadRequestException matchedWorkflowMissing(Long sessionId) {
    return new BadRequestException(
        "MATCHED_WORKFLOW_NOT_FOUND", "Matched workflow not found for session: " + sessionId);
  }

  private String workflowSummary(WorkflowDefinition workflow) {
    StringBuilder builder = new StringBuilder();
    builder.append(workflow.getName()).append(" (").append(workflow.getWorkflowCode()).append(")");
    if (workflow.getDescription() != null && !workflow.getDescription().isBlank()) {
      builder.append("\n").append(workflow.getDescription());
    }
    if (workflow.getGraphJson() != null && !workflow.getGraphJson().isBlank()) {
      builder.append("\nGraph JSON: ").append(workflow.getGraphJson());
    }
    return builder.toString();
  }

  private boolean isCustomerMessage(ChatMessage message) {
    String role = message.getSenderRole();
    if (role == null) return false;
    String normalized = role.toUpperCase(Locale.ROOT);
    return normalized.equals("USER") || normalized.equals("CUSTOMER");
  }

  private String latestCustomerMessage(List<ChatMessage> recentMessages) {
    for (int index = recentMessages.size() - 1; index >= 0; index--) {
      ChatMessage message = recentMessages.get(index);
      if (isCustomerMessage(message)
          && message.getContent() != null
          && !message.getContent().isBlank()) {
        return message.getContent();
      }
    }
    return "";
  }

  private String nullToEmpty(String value) {
    return value == null ? "" : value;
  }
}
