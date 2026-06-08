package com.init.workflowruntime.support;

import static org.mockito.AdditionalAnswers.delegatesTo;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.withSettings;

import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.domain.model.RiskDefinition;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.review.domain.model.ReviewSession;
import com.init.review.domain.model.ReviewTask;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.SimulationFeedback;
import com.init.workflowruntime.domain.SimulationGoldenCase;
import com.init.workflowruntime.domain.SimulationGoldenCaseReplayResult;
import com.init.workflowruntime.domain.SimulationImprovementCandidate;
import com.init.workflowruntime.domain.SimulationImprovementCandidateStatus;
import com.init.workflowruntime.domain.WorkflowExecution;
import java.time.OffsetDateTime;

public final class WorkflowRuntimeTestObjects {

  private WorkflowRuntimeTestObjects() {}

  public static ChatSession chatSessionWithId(ChatSession session, Long id) {
    ChatSession identified = delegatingMock(ChatSession.class, session);
    lenient().doReturn(id).when(identified).getId();
    return identified;
  }

  public static ChatSession chatSessionWithIdAndStartedAt(
      ChatSession session, Long id, OffsetDateTime startedAt) {
    ChatSession identified = chatSessionWithId(session, id);
    lenient().doReturn(startedAt).when(identified).getStartedAt();
    return identified;
  }

  public static ChatSession chatSessionWithStartedBy(ChatSession session, Long startedBy) {
    ChatSession stub = delegatingMock(ChatSession.class, session);
    lenient().doReturn(startedBy).when(stub).getStartedBy();
    return stub;
  }

  public static ChatSession chatSessionWithAssignedCounselorId(
      ChatSession session, Long assignedCounselorId) {
    ChatSession stub = delegatingMock(ChatSession.class, session);
    lenient().doReturn(assignedCounselorId).when(stub).getAssignedCounselorId();
    return stub;
  }

  public static ChatMessage chatMessageWithId(ChatMessage message, Long id) {
    ChatMessage identified = delegatingMock(ChatMessage.class, message);
    lenient().doReturn(id).when(identified).getId();
    return identified;
  }

  public static ChatMessage chatMessageWithIdAndCreatedAt(
      ChatMessage message, Long id, OffsetDateTime createdAt) {
    ChatMessage identified = chatMessageWithId(message, id);
    lenient().doReturn(createdAt).when(identified).getCreatedAt();
    return identified;
  }

  public static WorkflowExecution workflowExecutionWithId(WorkflowExecution execution, Long id) {
    WorkflowExecution identified = delegatingMock(WorkflowExecution.class, execution);
    lenient().doReturn(id).when(identified).getId();
    return identified;
  }

  public static WorkflowExecution workflowExecutionWithWorkflowDefinitionId(
      WorkflowExecution execution, Long workflowDefinitionId) {
    WorkflowExecution stub = delegatingMock(WorkflowExecution.class, execution);
    lenient().doReturn(workflowDefinitionId).when(stub).getWorkflowDefinitionId();
    return stub;
  }

  public static WorkflowExecution workflowExecutionWithIntentDefinitionId(
      WorkflowExecution execution, Long intentDefinitionId) {
    WorkflowExecution stub = delegatingMock(WorkflowExecution.class, execution);
    lenient().doReturn(intentDefinitionId).when(stub).getIntentDefinitionId();
    return stub;
  }

  public static WorkflowExecution workflowExecutionWithCurrentState(
      WorkflowExecution execution, String currentState) {
    WorkflowExecution stub = delegatingMock(WorkflowExecution.class, execution);
    lenient().doReturn(currentState).when(stub).getCurrentState();
    return stub;
  }

  public static IntentDefinition intentDefinitionWithId(IntentDefinition intent, Long id) {
    IntentDefinition identified = delegatingMock(IntentDefinition.class, intent);
    lenient().doReturn(id).when(identified).getId();
    return identified;
  }

  public static SlotDefinition slotDefinitionWithId(SlotDefinition slot, Long id) {
    SlotDefinition identified = delegatingMock(SlotDefinition.class, slot);
    lenient().doReturn(id).when(identified).getId();
    return identified;
  }

  public static SlotDefinition sensitiveSlotDefinition(SlotDefinition slot) {
    SlotDefinition stub = delegatingMock(SlotDefinition.class, slot);
    lenient().doReturn(true).when(stub).getIsSensitive();
    return stub;
  }

  public static PolicyDefinition policyDefinitionWithId(PolicyDefinition policy, Long id) {
    PolicyDefinition identified = delegatingMock(PolicyDefinition.class, policy);
    lenient().doReturn(id).when(identified).getId();
    return identified;
  }

  public static RiskDefinition riskDefinitionWithId(RiskDefinition risk, Long id) {
    RiskDefinition identified = delegatingMock(RiskDefinition.class, risk);
    lenient().doReturn(id).when(identified).getId();
    return identified;
  }

  public static WorkflowDefinition workflowDefinitionWithId(WorkflowDefinition workflow, Long id) {
    WorkflowDefinition identified = delegatingMock(WorkflowDefinition.class, workflow);
    lenient().doReturn(id).when(identified).getId();
    return identified;
  }

  public static WorkflowDefinition workflowDefinitionNamed(
      WorkflowDefinition workflow, String name) {
    WorkflowDefinition stub = delegatingMock(WorkflowDefinition.class, workflow);
    lenient().doReturn(name).when(stub).getName();
    return stub;
  }

  public static WorkflowDefinition workflowDefinitionWithGraphJson(
      WorkflowDefinition workflow, String graphJson) {
    WorkflowDefinition stub = delegatingMock(WorkflowDefinition.class, workflow);
    lenient().doReturn(graphJson).when(stub).getGraphJson();
    return stub;
  }

  public static WorkflowDefinition workflowDefinitionWithTerminalStatesJson(
      WorkflowDefinition workflow, String terminalStatesJson) {
    WorkflowDefinition stub = delegatingMock(WorkflowDefinition.class, workflow);
    lenient().doReturn(terminalStatesJson).when(stub).getTerminalStatesJson();
    return stub;
  }

  public static SimulationFeedback simulationFeedbackWithId(SimulationFeedback feedback, Long id) {
    SimulationFeedback identified = delegatingMock(SimulationFeedback.class, feedback);
    lenient().doReturn(id).when(identified).getId();
    return identified;
  }

  public static SimulationGoldenCase simulationGoldenCaseWithId(
      SimulationGoldenCase goldenCase, Long id) {
    SimulationGoldenCase identified = delegatingMock(SimulationGoldenCase.class, goldenCase);
    lenient().doReturn(id).when(identified).getId();
    return identified;
  }

  public static SimulationGoldenCaseReplayResult simulationReplayResultWithId(
      SimulationGoldenCaseReplayResult result, Long id) {
    SimulationGoldenCaseReplayResult identified =
        delegatingMock(SimulationGoldenCaseReplayResult.class, result);
    lenient().doReturn(id).when(identified).getId();
    return identified;
  }

  public static SimulationImprovementCandidate simulationCandidateWithId(
      SimulationImprovementCandidate candidate, Long id) {
    SimulationImprovementCandidate identified =
        delegatingMock(SimulationImprovementCandidate.class, candidate);
    lenient().doReturn(id).when(identified).getId();
    return identified;
  }

  public static SimulationImprovementCandidate simulationCandidateWithWorkspaceId(
      SimulationImprovementCandidate candidate, Long workspaceId) {
    SimulationImprovementCandidate stub =
        delegatingMock(SimulationImprovementCandidate.class, candidate);
    lenient().doReturn(workspaceId).when(stub).getWorkspaceId();
    return stub;
  }

  public static SimulationImprovementCandidate simulationCandidateWithStatus(
      SimulationImprovementCandidate candidate, SimulationImprovementCandidateStatus status) {
    SimulationImprovementCandidate stub =
        delegatingMock(SimulationImprovementCandidate.class, candidate);
    lenient().doReturn(status).when(stub).getStatus();
    return stub;
  }

  public static ReviewTask reviewTaskWithId(ReviewTask task, Long id) {
    ReviewTask identified = delegatingMock(ReviewTask.class, task);
    lenient().doReturn(id).when(identified).getId();
    return identified;
  }

  public static ReviewSession reviewSessionWithId(ReviewSession session, Long id) {
    ReviewSession identified = delegatingMock(ReviewSession.class, session);
    lenient().doReturn(id).when(identified).getId();
    return identified;
  }

  private static <T> T delegatingMock(Class<T> type, T delegate) {
    return mock(type, withSettings().lenient().defaultAnswer(delegatesTo(delegate)));
  }
}
