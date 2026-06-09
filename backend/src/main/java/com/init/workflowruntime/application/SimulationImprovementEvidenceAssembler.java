package com.init.workflowruntime.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.NullNode;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.workflowruntime.application.dto.SimulationImprovementEvidence;
import com.init.workflowruntime.application.dto.SimulationImprovementEvidence.DomainPackContext;
import com.init.workflowruntime.application.dto.SimulationImprovementEvidence.GoldenReplay;
import com.init.workflowruntime.application.dto.SimulationImprovementEvidence.IntentView;
import com.init.workflowruntime.application.dto.SimulationImprovementEvidence.PolicyView;
import com.init.workflowruntime.application.dto.SimulationImprovementEvidence.RiskView;
import com.init.workflowruntime.application.dto.SimulationImprovementEvidence.SessionMeta;
import com.init.workflowruntime.application.dto.SimulationImprovementEvidence.SlotView;
import com.init.workflowruntime.application.dto.SimulationImprovementEvidence.Turn;
import com.init.workflowruntime.application.dto.SimulationImprovementEvidence.WorkflowView;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.SimulationFeedback;
import com.init.workflowruntime.domain.SimulationGoldenCase;
import com.init.workflowruntime.domain.SimulationGoldenCaseReplayResult;
import com.init.workflowruntime.domain.SimulationGoldenCaseReplayResultRepository;
import com.init.workflowruntime.domain.SimulationGoldenCaseRepository;
import com.init.workflowruntime.domain.WorkflowExecution;
import com.init.workflowruntime.domain.WorkflowExecutionRepository;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * 시뮬레이션 개선 후보를 위한 evidence package를 백엔드에서 조립한다. 프론트엔드 프롬프트 조립을 막기 위해 대화 전사, 런타임 상태, 골든 리플레이 실패, 대상
 * Domain Pack 컨텍스트를 모두 백엔드 조회로 모은다. 어떤 DB 변경도 하지 않는다.
 */
@Component
public class SimulationImprovementEvidenceAssembler {

  private static final int MAX_RECENT_TURNS = 12;
  private static final int MAX_JSON_FIELD_LENGTH = 2000;

  private final ChatMessageRepository chatMessageRepository;
  private final WorkflowExecutionRepository workflowExecutionRepository;
  private final SimulationGoldenCaseRepository goldenCaseRepository;
  private final SimulationGoldenCaseReplayResultRepository replayResultRepository;
  private final IntentDefinitionRepository intentDefinitionRepository;
  private final SlotDefinitionRepository slotDefinitionRepository;
  private final WorkflowDefinitionRepository workflowDefinitionRepository;
  private final PolicyDefinitionRepository policyDefinitionRepository;
  private final RiskDefinitionRepository riskDefinitionRepository;
  private final ObjectMapper objectMapper;

  public SimulationImprovementEvidenceAssembler(
      ChatMessageRepository chatMessageRepository,
      WorkflowExecutionRepository workflowExecutionRepository,
      SimulationGoldenCaseRepository goldenCaseRepository,
      SimulationGoldenCaseReplayResultRepository replayResultRepository,
      IntentDefinitionRepository intentDefinitionRepository,
      SlotDefinitionRepository slotDefinitionRepository,
      WorkflowDefinitionRepository workflowDefinitionRepository,
      PolicyDefinitionRepository policyDefinitionRepository,
      RiskDefinitionRepository riskDefinitionRepository,
      ObjectMapper objectMapper) {
    this.chatMessageRepository = chatMessageRepository;
    this.workflowExecutionRepository = workflowExecutionRepository;
    this.goldenCaseRepository = goldenCaseRepository;
    this.replayResultRepository = replayResultRepository;
    this.intentDefinitionRepository = intentDefinitionRepository;
    this.slotDefinitionRepository = slotDefinitionRepository;
    this.workflowDefinitionRepository = workflowDefinitionRepository;
    this.policyDefinitionRepository = policyDefinitionRepository;
    this.riskDefinitionRepository = riskDefinitionRepository;
    this.objectMapper = objectMapper;
  }

  public SimulationImprovementEvidence assemble(SimulationFeedback feedback, ChatSession session) {
    Long versionId = session.getDomainPackVersionId();
    WorkflowExecution execution =
        workflowExecutionRepository
            .findTopByChatSessionIdOrderByStartedAtDescIdDesc(session.getId())
            .orElse(null);
    return new SimulationImprovementEvidence(
        feedbackEvidence(feedback),
        sessionMeta(session, execution, versionId),
        goldenReplay(session.getId()),
        domainPackContext(versionId));
  }

  private SimulationImprovementEvidence.Feedback feedbackEvidence(SimulationFeedback feedback) {
    return new SimulationImprovementEvidence.Feedback(
        feedback.getId(),
        feedback.getFeedbackType() == null ? null : feedback.getFeedbackType().name(),
        feedback.getDescription(),
        feedback.getExpectedBehavior(),
        feedback.getSeverity() == null ? null : feedback.getSeverity().name(),
        feedback.getChatMessageId());
  }

  private SessionMeta sessionMeta(
      ChatSession session, WorkflowExecution execution, Long versionId) {
    String matchedWorkflowCode = matchedWorkflowCode(execution, versionId);
    return new SessionMeta(
        session.getId(),
        execution == null ? null : execution.getStatus(),
        execution == null ? null : execution.getCurrentState(),
        selectedIntentCode(session),
        matchedWorkflowCode,
        slotValues(execution),
        recentTurns(session.getId()));
  }

  private String matchedWorkflowCode(WorkflowExecution execution, Long versionId) {
    if (execution == null || execution.getWorkflowDefinitionId() == null) {
      return null;
    }
    return workflowDefinitionRepository
        .findByIdAndDomainPackVersionId(execution.getWorkflowDefinitionId(), versionId)
        .map(workflow -> workflow.getWorkflowCode())
        .orElse(null);
  }

  private String selectedIntentCode(ChatSession session) {
    JsonNode meta = readTree(session.getMetaJson());
    JsonNode value = meta.get("selectedIntentCode");
    if (value == null || value.isNull() || !value.isTextual()) {
      return null;
    }
    String text = value.asText().strip();
    return text.isEmpty() ? null : text;
  }

  private JsonNode slotValues(WorkflowExecution execution) {
    if (execution == null) {
      return NullNode.getInstance();
    }
    return readTree(execution.getSlotValuesJson());
  }

  private List<Turn> recentTurns(Long sessionId) {
    List<ChatMessage> messages =
        chatMessageRepository.findByChatSessionIdOrderBySeqNoAsc(sessionId);
    int from = Math.max(0, messages.size() - MAX_RECENT_TURNS);
    return messages.subList(from, messages.size()).stream()
        .map(message -> new Turn(message.getSenderRole(), message.getContent()))
        .toList();
  }

  private GoldenReplay goldenReplay(Long sessionId) {
    SimulationGoldenCase goldenCase =
        goldenCaseRepository.findBySourceChatSessionId(sessionId).orElse(null);
    if (goldenCase == null) {
      return null;
    }
    SimulationGoldenCaseReplayResult replay =
        replayResultRepository.findLatestByGoldenCaseId(goldenCase.getId()).orElse(null);
    if (replay == null) {
      return new GoldenReplay(goldenCase.getId(), null, null, null, null, null);
    }
    return new GoldenReplay(
        goldenCase.getId(),
        replay.getId(),
        replay.getStatus() == null ? null : replay.getStatus().name(),
        truncate(replay.getExpectedJson()),
        truncate(replay.getActualJson()),
        replay.getFailureSummary());
  }

  private DomainPackContext domainPackContext(Long versionId) {
    List<IntentView> intents =
        intentDefinitionRepository.findByDomainPackVersionId(versionId).stream()
            .map(
                intent ->
                    new IntentView(
                        intent.getIntentCode(), intent.getName(), intent.getDescription()))
            .toList();
    List<SlotView> slots =
        slotDefinitionRepository.findAllByDomainPackVersionIdOrderBySlotCodeAsc(versionId).stream()
            .map(
                slot ->
                    new SlotView(
                        slot.getSlotCode(),
                        slot.getName(),
                        slot.getDescription(),
                        truncate(slot.getValidationRuleJson())))
            .toList();
    List<WorkflowView> workflows =
        workflowDefinitionRepository.findAllByDomainPackVersionId(versionId).stream()
            .map(
                workflow ->
                    new WorkflowView(
                        workflow.getWorkflowCode(),
                        workflow.getName(),
                        workflow.getDescription(),
                        truncate(workflow.getGraphJson())))
            .toList();
    List<PolicyView> policies =
        policyDefinitionRepository
            .findAllByDomainPackVersionIdOrderByPolicyCodeAsc(versionId)
            .stream()
            .map(
                policy ->
                    new PolicyView(
                        policy.getPolicyCode(),
                        policy.getName(),
                        policy.getDescription(),
                        truncate(policy.getConditionJson())))
            .toList();
    List<RiskView> risks =
        riskDefinitionRepository.findAllByDomainPackVersionIdOrderByRiskCodeAsc(versionId).stream()
            .map(
                risk ->
                    new RiskView(
                        risk.getRiskCode(),
                        risk.getName(),
                        risk.getDescription(),
                        truncate(risk.getTriggerConditionJson())))
            .toList();
    return new DomainPackContext(versionId, intents, slots, workflows, policies, risks);
  }

  private JsonNode readTree(String json) {
    if (json == null || json.isBlank()) {
      return NullNode.getInstance();
    }
    try {
      return objectMapper.readTree(json);
    } catch (JsonProcessingException e) {
      return NullNode.getInstance();
    }
  }

  private String truncate(String value) {
    if (value == null || value.length() <= MAX_JSON_FIELD_LENGTH) {
      return value;
    }
    return value.substring(0, MAX_JSON_FIELD_LENGTH);
  }
}
