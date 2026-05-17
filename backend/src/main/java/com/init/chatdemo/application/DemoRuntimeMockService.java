package com.init.chatdemo.application;

import com.init.chatdemo.presentation.dto.DemoChatSessionEndpointResponse;
import com.init.chatdemo.presentation.dto.DemoChatSessionResponse;
import com.init.chatdemo.presentation.dto.DemoChatWorkflowResponse;
import com.init.chatdemo.presentation.dto.DemoDecisionLogEndpointResponse;
import com.init.chatdemo.presentation.dto.DemoDecisionLogResponse;
import com.init.chatdemo.presentation.dto.DemoDomainPackEndpointResponse;
import com.init.chatdemo.presentation.dto.DemoExecutionResponse;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class DemoRuntimeMockService {

  private final DemoRuntimeFixture fixture;

  public DemoRuntimeMockService(DemoRuntimeFixture fixture) {
    this.fixture = fixture;
  }

  public DemoChatWorkflowResponse getChatWorkflow(Long workspaceId) {
    DemoChatWorkflowResponse result = fixture.provideChatWorkflow(workspaceId);
    if (result == null) {
      throw new NotFoundException(
          "DEMO_WORKSPACE_NOT_FOUND", "Chat workflow not found for workspace: " + workspaceId);
    }
    return result;
  }

  public DemoDomainPackEndpointResponse getDomainPack(Long workspaceId) {
    DemoChatWorkflowResponse chatWorkflow = getChatWorkflow(workspaceId);
    return new DemoDomainPackEndpointResponse(chatWorkflow.domainPack(), chatWorkflow.workflow());
  }

  public DemoChatSessionEndpointResponse getChatSession(Long workspaceId, String sessionId) {
    DemoChatSessionResponse session = fixture.findSession(workspaceId, sessionId);
    if (session == null) {
      throw new NotFoundException(
          "DEMO_CHAT_SESSION_NOT_FOUND", "Chat session not found: " + sessionId);
    }
    return new DemoChatSessionEndpointResponse(
        session, fixture.findSessionMessages(workspaceId, sessionId));
  }

  public DemoExecutionResponse getWorkflowExecution(Long workspaceId, String executionId) {
    DemoExecutionResponse execution = fixture.findExecution(workspaceId, executionId);
    if (execution == null) {
      throw new NotFoundException(
          "DEMO_EXECUTION_NOT_FOUND", "Execution not found: " + executionId);
    }
    return execution;
  }

  public DemoDecisionLogEndpointResponse getDecisionLogs(Long workspaceId, String executionId) {
    if (executionId == null || executionId.isBlank()) {
      throw new BadRequestException("DEMO_EXECUTION_ID_REQUIRED", "executionId is required");
    }
    List<DemoDecisionLogResponse> decisionLogs = fixture.findDecisionLogs(workspaceId, executionId);
    if (decisionLogs.isEmpty()) {
      throw new NotFoundException(
          "DEMO_EXECUTION_NOT_FOUND", "Execution not found: " + executionId);
    }
    return new DemoDecisionLogEndpointResponse(decisionLogs);
  }
}
