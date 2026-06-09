package com.init.workflowruntime.application;

import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.chatMessageWithId;
import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.chatSessionWithId;
import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.simulationFeedbackWithId;
import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.simulationGoldenCaseWithId;
import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.simulationReplayResultWithId;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.domain.model.RiskDefinition;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.workflowruntime.application.dto.SimulationImprovementEvidence;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.SimulationFeedback;
import com.init.workflowruntime.domain.SimulationFeedbackContent;
import com.init.workflowruntime.domain.SimulationFeedbackSeverity;
import com.init.workflowruntime.domain.SimulationFeedbackType;
import com.init.workflowruntime.domain.SimulationGoldenCase;
import com.init.workflowruntime.domain.SimulationGoldenCaseReplayResult;
import com.init.workflowruntime.domain.SimulationGoldenCaseReplayResultRepository;
import com.init.workflowruntime.domain.SimulationGoldenCaseReplayStatus;
import com.init.workflowruntime.domain.SimulationGoldenCaseRepository;
import com.init.workflowruntime.domain.WorkflowExecutionRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("SimulationImprovementEvidenceAssembler")
class SimulationImprovementEvidenceAssemblerTest {

  private static final Long WORKSPACE_ID = 10L;
  private static final Long USER_ID = 7L;
  private static final Long VERSION_ID = 101L;
  private static final Long SESSION_ID = 55L;
  private static final Long FEEDBACK_ID = 901L;
  private static final Long GOLDEN_CASE_ID = 789L;
  private static final Long REPLAY_ID = 790L;

  @Mock private ChatMessageRepository chatMessageRepository;
  @Mock private WorkflowExecutionRepository workflowExecutionRepository;
  @Mock private SimulationGoldenCaseRepository goldenCaseRepository;
  @Mock private SimulationGoldenCaseReplayResultRepository replayResultRepository;
  @Mock private IntentDefinitionRepository intentDefinitionRepository;
  @Mock private SlotDefinitionRepository slotDefinitionRepository;
  @Mock private WorkflowDefinitionRepository workflowDefinitionRepository;
  @Mock private PolicyDefinitionRepository policyDefinitionRepository;
  @Mock private RiskDefinitionRepository riskDefinitionRepository;

  private SimulationImprovementEvidenceAssembler assembler() {
    return new SimulationImprovementEvidenceAssembler(
        chatMessageRepository,
        workflowExecutionRepository,
        goldenCaseRepository,
        replayResultRepository,
        intentDefinitionRepository,
        slotDefinitionRepository,
        workflowDefinitionRepository,
        policyDefinitionRepository,
        riskDefinitionRepository,
        new ObjectMapper());
  }

  private SimulationFeedback feedback() {
    return simulationFeedbackWithId(
        SimulationFeedback.create(
            WORKSPACE_ID,
            SESSION_ID,
            5L,
            new SimulationFeedbackContent(
                SimulationFeedbackType.MISSING_SLOT_QUESTION,
                "픽업 날짜를 묻지 않았습니다.",
                "픽업 날짜를 먼저 묻기",
                SimulationFeedbackSeverity.HIGH),
            USER_ID),
        FEEDBACK_ID);
  }

  private ChatSession session() {
    return chatSessionWithId(
        ChatSession.create(
            WORKSPACE_ID,
            VERSION_ID,
            ChatSessionStatus.OPEN,
            SimulationService.SIMULATION_CHANNEL,
            "{\"selectedIntentCode\":\"pickup\"}",
            USER_ID),
        SESSION_ID);
  }

  private void givenConversation() {
    ChatMessage userTurn =
        chatMessageWithId(ChatMessage.create(SESSION_ID, 1, "USER", "TEXT", "공항 픽업 예약하고 싶어요"), 1L);
    ChatMessage assistantTurn =
        chatMessageWithId(
            ChatMessage.create(SESSION_ID, 2, "ASSISTANT", "TEXT", "어떤 도움이 필요하신가요?"), 2L);
    given(chatMessageRepository.findByChatSessionIdOrderBySeqNoAsc(SESSION_ID))
        .willReturn(List.of(userTurn, assistantTurn));
    given(workflowExecutionRepository.findTopByChatSessionIdOrderByStartedAtDescIdDesc(SESSION_ID))
        .willReturn(Optional.empty());
  }

  private void givenDomainPack() {
    given(intentDefinitionRepository.findByDomainPackVersionId(VERSION_ID))
        .willReturn(
            List.of(
                IntentDefinition.create(
                    VERSION_ID, "pickup", "픽업 예약", "공항 픽업 예약 의도", 1, "{}", "{}", "[]", "{}")));
    given(slotDefinitionRepository.findAllByDomainPackVersionIdOrderBySlotCodeAsc(VERSION_ID))
        .willReturn(
            List.of(
                SlotDefinition.create(
                    VERSION_ID,
                    "pickupDate",
                    "픽업 날짜",
                    "예약 픽업 날짜",
                    "DATE",
                    false,
                    "{}",
                    null,
                    "{}")));
    given(workflowDefinitionRepository.findAllByDomainPackVersionId(VERSION_ID))
        .willReturn(
            List.of(
                WorkflowDefinition.create(
                    VERSION_ID,
                    "airport_pickup_reservation_flow",
                    "공항 픽업 예약",
                    "예약 흐름",
                    "{\"nodes\":[]}",
                    "start",
                    "[]",
                    "[]",
                    "{}",
                    1L,
                    true,
                    "{}")));
    given(policyDefinitionRepository.findAllByDomainPackVersionIdOrderByPolicyCodeAsc(VERSION_ID))
        .willReturn(
            List.of(
                PolicyDefinition.create(
                    VERSION_ID,
                    "pickup_policy",
                    "픽업 정책",
                    "정책 설명",
                    "HIGH",
                    "{}",
                    "{}",
                    "[]",
                    "{}")));
    given(riskDefinitionRepository.findAllByDomainPackVersionIdOrderByRiskCodeAsc(VERSION_ID))
        .willReturn(
            List.of(
                RiskDefinition.create(
                    VERSION_ID, "pickup_risk", "픽업 위험", "위험 설명", "HIGH", "{}", "{}", "[]", "{}")));
  }

  @Test
  @DisplayName("피드백·대화·골든 리플레이·Domain Pack 컨텍스트를 evidence로 모은다")
  void shouldAssembleFullEvidence() {
    givenConversation();
    givenDomainPack();
    SimulationGoldenCase goldenCase =
        simulationGoldenCaseWithId(
            SimulationGoldenCase.create(
                WORKSPACE_ID, SESSION_ID, VERSION_ID, "case", "[]", "{}", USER_ID),
            GOLDEN_CASE_ID);
    SimulationGoldenCaseReplayResult replay =
        simulationReplayResultWithId(
            SimulationGoldenCaseReplayResult.record(
                WORKSPACE_ID,
                GOLDEN_CASE_ID,
                VERSION_ID,
                999L,
                SimulationGoldenCaseReplayStatus.FAIL,
                "{}",
                "{}",
                "actionType expected ASK_SLOT but was NEED_INTENT",
                USER_ID),
            REPLAY_ID);
    given(goldenCaseRepository.findBySourceChatSessionId(SESSION_ID))
        .willReturn(Optional.of(goldenCase));
    given(replayResultRepository.findLatestByGoldenCaseId(GOLDEN_CASE_ID))
        .willReturn(Optional.of(replay));

    SimulationImprovementEvidence evidence = assembler().assemble(feedback(), session());

    assertThat(evidence.feedback().feedbackId()).isEqualTo(FEEDBACK_ID);
    assertThat(evidence.feedback().feedbackType()).isEqualTo("MISSING_SLOT_QUESTION");
    assertThat(evidence.feedback().severity()).isEqualTo("HIGH");
    assertThat(evidence.feedback().chatMessageId()).isEqualTo(5L);
    assertThat(evidence.session().selectedIntentCode()).isEqualTo("pickup");
    assertThat(evidence.session().recentTurns()).hasSize(2);
    assertThat(evidence.goldenReplay().goldenCaseId()).isEqualTo(GOLDEN_CASE_ID);
    assertThat(evidence.goldenReplay().replayResultId()).isEqualTo(REPLAY_ID);
    assertThat(evidence.goldenReplay().status()).isEqualTo("FAIL");
    assertThat(evidence.goldenReplay().failureSummary()).contains("ASK_SLOT");
    assertThat(evidence.domainPack().intents()).hasSize(1);
    assertThat(evidence.domainPack().intents().get(0).intentCode()).isEqualTo("pickup");
    assertThat(evidence.domainPack().slots()).hasSize(1);
    assertThat(evidence.domainPack().workflows()).hasSize(1);
    assertThat(evidence.domainPack().policies()).hasSize(1);
    assertThat(evidence.domainPack().risks()).hasSize(1);
  }

  @Test
  @DisplayName("골든 케이스가 없으면 goldenReplay는 null이다")
  void shouldOmitGoldenReplay_whenNoGoldenCase() {
    givenConversation();
    givenDomainPack();
    given(goldenCaseRepository.findBySourceChatSessionId(SESSION_ID)).willReturn(Optional.empty());

    SimulationImprovementEvidence evidence = assembler().assemble(feedback(), session());

    assertThat(evidence.goldenReplay()).isNull();
  }

  @Test
  @DisplayName("긴 workflow graph JSON은 상한 길이로 절단된다")
  void shouldTruncateLongJsonFields() {
    given(chatMessageRepository.findByChatSessionIdOrderBySeqNoAsc(SESSION_ID))
        .willReturn(List.of());
    given(workflowExecutionRepository.findTopByChatSessionIdOrderByStartedAtDescIdDesc(SESSION_ID))
        .willReturn(Optional.empty());
    given(goldenCaseRepository.findBySourceChatSessionId(SESSION_ID)).willReturn(Optional.empty());
    given(intentDefinitionRepository.findByDomainPackVersionId(VERSION_ID)).willReturn(List.of());
    given(slotDefinitionRepository.findAllByDomainPackVersionIdOrderBySlotCodeAsc(VERSION_ID))
        .willReturn(List.of());
    given(policyDefinitionRepository.findAllByDomainPackVersionIdOrderByPolicyCodeAsc(VERSION_ID))
        .willReturn(List.of());
    given(riskDefinitionRepository.findAllByDomainPackVersionIdOrderByRiskCodeAsc(VERSION_ID))
        .willReturn(List.of());
    String longGraph = "x".repeat(2500);
    given(workflowDefinitionRepository.findAllByDomainPackVersionId(VERSION_ID))
        .willReturn(
            List.of(
                WorkflowDefinition.create(
                    VERSION_ID,
                    "flow",
                    "흐름",
                    "설명",
                    longGraph,
                    "start",
                    "[]",
                    "[]",
                    "{}",
                    1L,
                    true,
                    "{}")));

    SimulationImprovementEvidence evidence = assembler().assemble(feedback(), session());

    assertThat(evidence.domainPack().workflows().get(0).graph()).hasSize(2000);
  }
}
