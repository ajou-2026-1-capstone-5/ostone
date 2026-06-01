package com.init.workflowruntime.application.matching;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.infrastructure.persistence.WorkflowMatchDecisionJdbcRepository;
import com.init.workflowruntime.infrastructure.persistence.WorkflowMatchingProfileJdbcRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("WorkflowMatchingService")
class WorkflowMatchingServiceTest {

  @Mock private EmbeddingClient embeddingClient;
  @Mock private ChatSessionRepository chatSessionRepository;
  @Mock private WorkflowMatchingProfileJdbcRepository profileRepository;
  @Mock private WorkflowMatchDecisionJdbcRepository decisionRepository;

  private WorkflowMatchingService service;

  @BeforeEach
  void setUp() {
    service =
        new WorkflowMatchingService(
            embeddingProperties(),
            embeddingClient,
            new SensitiveTextRedactor(),
            chatSessionRepository,
            profileRepository,
            decisionRepository,
            new ObjectMapper(),
            new SimpleMeterRegistry(),
            Clock.fixed(Instant.parse("2026-05-31T00:00:00Z"), ZoneOffset.UTC));
  }

  @Test
  @DisplayName("replay fitness가 기준을 넘으면 명시 autoRun 플래그 없이도 CONFIDENT를 반환한다")
  void should_returnConfident_when_replayFitnessIsEligible() {
    givenSession();
    given(profileRepository.countActiveProfiles(101L)).willReturn(2);
    given(embeddingClient.embed(anyString(), eq(EmbeddingInputType.SEARCH_QUERY)))
        .willReturn(vector(1.0f, 0.0f));
    given(profileRepository.findNearestActive(eq(101L), anyString(), anyString(), eq(30)))
        .willReturn(
            List.of(
                candidate(
                    20L,
                    10L,
                    "refund_request",
                    "환불 요청",
                    "refund_flow",
                    "환불 접수",
                    0.96,
                    "{\"optionalTerms\":[\"환불\"]}",
                    "{\"workflowReplayFitness\":0.82,\"workflowPrecision\":0.70}"),
                candidate(
                    21L,
                    11L,
                    "change_address",
                    "배송지 변경",
                    "address_flow",
                    "배송지 변경",
                    0.60,
                    "{\"optionalTerms\":[\"배송지\"]}",
                    "{\"workflowReplayFitness\":0.90}")));

    WorkflowMatchResult result = service.match(1L, "환불하고 싶어요", "");

    assertThat(result.status()).isEqualTo("CONFIDENT");
    assertThat(result.candidates().getFirst().workflowDefinitionId()).isEqualTo(20L);
    verify(profileRepository)
        .findNearestActive(
            eq(101L), anyString(), org.mockito.ArgumentMatchers.contains("\"환불\""), eq(30));
    verify(decisionRepository)
        .record(
            eq(1L),
            eq(101L),
            eq(20L),
            eq(10L),
            eq("CONFIDENT"),
            eq(result.candidates().getFirst().confidence()),
            anyString(),
            eq("profile-v1"),
            eq("bedrock"),
            eq("cohere.embed-multilingual-v3"),
            eq("ap-northeast-1"),
            anyString(),
            anyString(),
            anyString(),
            eq(null));
  }

  @Test
  @DisplayName("active negative term이 걸리면 BLOCKED로 감사 로그를 남기고 자동 실행하지 않는다")
  void should_blockAutoRun_when_negativeTermMatches() {
    givenSession();
    given(profileRepository.countActiveProfiles(101L)).willReturn(1);
    given(embeddingClient.embed(anyString(), eq(EmbeddingInputType.SEARCH_QUERY)))
        .willReturn(vector(1.0f, 0.0f));
    given(profileRepository.findNearestActive(eq(101L), anyString(), anyString(), eq(30)))
        .willReturn(
            List.of(
                candidate(
                    20L,
                    10L,
                    "refund_request",
                    "환불 요청",
                    "refund_flow",
                    "환불 접수",
                    0.96,
                    "{\"negativeTerms\":[\"취소\"],\"optionalTerms\":[\"환불\"]}",
                    "{\"workflowReplayFitness\":0.90}")));

    WorkflowMatchResult result = service.match(1L, "취소하고 싶어요", "");

    assertThat(result.status()).isEqualTo("BLOCKED");
    verify(decisionRepository)
        .record(
            eq(1L),
            eq(101L),
            eq(null),
            eq(null),
            eq("BLOCKED"),
            eq(result.candidates().getFirst().confidence()),
            anyString(),
            eq("profile-v1"),
            eq("bedrock"),
            eq("cohere.embed-multilingual-v3"),
            eq("ap-northeast-1"),
            anyString(),
            anyString(),
            anyString(),
            eq("negative_route_term"));
  }

  @Test
  @DisplayName("negative term이 부정 표현에 걸린 후보는 차단하지 않는다")
  void should_notBlock_when_negativeTermIsNegated() {
    givenSession();
    given(profileRepository.countActiveProfiles(101L)).willReturn(1);
    given(embeddingClient.embed(anyString(), eq(EmbeddingInputType.SEARCH_QUERY)))
        .willReturn(vector(1.0f, 0.0f));
    given(profileRepository.findNearestActive(eq(101L), anyString(), anyString(), eq(30)))
        .willReturn(
            List.of(
                candidate(
                    20L,
                    10L,
                    "refund_request",
                    "환불 요청",
                    "refund_flow",
                    "환불 접수",
                    0.96,
                    "{\"negativeTerms\":[\"취소\"],\"optionalTerms\":[\"환불\"]}",
                    "{\"workflowReplayFitness\":0.90,\"workflowPrecision\":0.80}")));

    WorkflowMatchResult result = service.match(1L, "취소 말고 환불하고 싶어요", "");

    assertThat(result.status()).isEqualTo("CONFIDENT");
    assertThat(result.candidates().getFirst().blocked()).isFalse();
  }

  @Test
  @DisplayName("blocked 후보가 있어도 안전한 대체 후보가 있으면 그 후보를 선택한다")
  void should_demoteBlockedCandidateAndSelectSafeAlternative() {
    givenSession();
    given(profileRepository.countActiveProfiles(101L)).willReturn(2);
    given(embeddingClient.embed(anyString(), eq(EmbeddingInputType.SEARCH_QUERY)))
        .willReturn(vector(1.0f, 0.0f));
    given(profileRepository.findNearestActive(eq(101L), anyString(), anyString(), eq(30)))
        .willReturn(
            List.of(
                candidate(
                    21L,
                    11L,
                    "cancel_request",
                    "주문 취소",
                    "cancel_flow",
                    "취소 접수",
                    0.99,
                    "{\"negativeTerms\":[\"환불\"],\"optionalTerms\":[\"취소\"]}",
                    "{\"workflowReplayFitness\":0.95,\"workflowPrecision\":0.90}"),
                candidate(
                    20L,
                    10L,
                    "refund_request",
                    "환불 요청",
                    "refund_flow",
                    "환불 접수",
                    0.88,
                    "{\"optionalTerms\":[\"환불\"]}",
                    "{\"workflowReplayFitness\":0.90,\"workflowPrecision\":0.80}")));

    WorkflowMatchResult result = service.match(1L, "환불하고 싶어요", "");

    assertThat(result.status()).isEqualTo("CONFIDENT");
    assertThat(result.candidates().getFirst().workflowDefinitionId()).isEqualTo(20L);
  }

  @Test
  @DisplayName("required route term이 부족하면 점수가 높아도 CONFIDENT로 자동 실행하지 않는다")
  void should_notAutoRun_when_requiredRouteTermsAreMissing() {
    givenSession();
    given(profileRepository.countActiveProfiles(101L)).willReturn(1);
    given(embeddingClient.embed(anyString(), eq(EmbeddingInputType.SEARCH_QUERY)))
        .willReturn(vector(1.0f, 0.0f));
    given(profileRepository.findNearestActive(eq(101L), anyString(), anyString(), eq(30)))
        .willReturn(
            List.of(
                candidate(
                    20L,
                    10L,
                    "refund_request",
                    "환불 요청",
                    "refund_flow",
                    "환불 접수",
                    0.96,
                    "{\"requiredTerms\":[\"송장\"],\"optionalTerms\":[\"환불\"],\"confidence\":0.80}",
                    "{\"workflowReplayFitness\":0.90,\"workflowPrecision\":0.80}")));

    WorkflowMatchResult result = service.match(1L, "환불하고 싶어요", "");

    assertThat(result.status()).isEqualTo("AMBIGUOUS");
    assertThat(result.candidates().getFirst().autoRunEligible()).isFalse();
    assertThat(result.candidates().getFirst().autoRunBlockReason())
        .isEqualTo("missing_required_route_terms");
    verify(decisionRepository)
        .record(
            eq(1L),
            eq(101L),
            eq(null),
            eq(null),
            eq("AMBIGUOUS"),
            eq(result.candidates().getFirst().confidence()),
            anyString(),
            eq("profile-v1"),
            eq("bedrock"),
            eq("cohere.embed-multilingual-v3"),
            eq("ap-northeast-1"),
            anyString(),
            org.mockito.ArgumentMatchers.contains("missing_required_route_terms"),
            org.mockito.ArgumentMatchers.contains("missing_required_route_terms"),
            eq("missing_required_route_terms"));
  }

  @Test
  @DisplayName("intent entry required term이 부족하면 workflow route가 맞아도 자동 실행하지 않는다")
  void should_notAutoRun_when_intentEntryRequiredTermsAreMissing() {
    givenSession();
    given(profileRepository.countActiveProfiles(101L)).willReturn(1);
    given(embeddingClient.embed(anyString(), eq(EmbeddingInputType.SEARCH_QUERY)))
        .willReturn(vector(1.0f, 0.0f));
    given(profileRepository.findNearestActive(eq(101L), anyString(), anyString(), eq(30)))
        .willReturn(
            List.of(
                candidateWithEntryCondition(
                    20L,
                    10L,
                    "refund_request",
                    "환불 요청",
                    "refund_flow",
                    "환불 접수",
                    0.96,
                    "{\"requiredTerms\":[\"본인인증\"]}",
                    "{\"optionalTerms\":[\"환불\"]}",
                    "{\"workflowReplayFitness\":0.90,\"workflowPrecision\":0.80}")));

    WorkflowMatchResult result = service.match(1L, "환불하고 싶어요", "");

    assertThat(result.status()).isEqualTo("AMBIGUOUS");
    assertThat(result.candidates().getFirst().autoRunBlockReason())
        .isEqualTo("missing_required_route_terms");
  }

  @Test
  @DisplayName("requiredAnyTerms와 synonym group 중 하나가 맞으면 route evidence로 인정한다")
  void should_matchRouteEvidenceWithRequiredAnyTermsAndSynonymGroup() {
    givenSession();
    given(profileRepository.countActiveProfiles(101L)).willReturn(1);
    given(embeddingClient.embed(anyString(), eq(EmbeddingInputType.SEARCH_QUERY)))
        .willReturn(vector(1.0f, 0.0f));
    given(profileRepository.findNearestActive(eq(101L), anyString(), anyString(), eq(30)))
        .willReturn(
            List.of(
                candidate(
                    20L,
                    10L,
                    "refund_request",
                    "환불 요청",
                    "refund_flow",
                    "환불 접수",
                    0.96,
                    "{\"requiredAnyTerms\":[[\"환불\",\"반품\"]],\"optionalTerms\":[{\"terms\":[\"결제\",\"카드\"]}]}",
                    "{\"workflowReplayFitness\":0.90,\"workflowPrecision\":0.80}")));

    WorkflowMatchResult result = service.match(1L, "카드 결제 반품하고 싶어요", "");

    assertThat(result.status()).isEqualTo("CONFIDENT");
    assertThat(result.candidates().getFirst().routeScore()).isGreaterThan(0.70);
  }

  @Test
  @DisplayName("semantic floor가 낮으면 route evidence가 있어도 CONFIDENT로 자동 실행하지 않는다")
  void should_notAutoRun_when_semanticScoreIsBelowFloor() {
    givenSession();
    given(profileRepository.countActiveProfiles(101L)).willReturn(1);
    given(embeddingClient.embed(anyString(), eq(EmbeddingInputType.SEARCH_QUERY)))
        .willReturn(vector(1.0f, 0.0f));
    given(profileRepository.findNearestActive(eq(101L), anyString(), anyString(), eq(30)))
        .willReturn(
            List.of(
                candidate(
                    20L,
                    10L,
                    "refund_request",
                    "환불 요청",
                    "refund_flow",
                    "환불 접수",
                    0.60,
                    "{\"optionalTerms\":[\"환불\"],\"confidence\":0.90}",
                    "{\"workflowReplayFitness\":0.90,\"workflowPrecision\":0.80}")));

    WorkflowMatchResult result = service.match(1L, "환불하고 싶어요", "");

    assertThat(result.status()).isEqualTo("AMBIGUOUS");
    assertThat(result.candidates().getFirst().autoRunBlockReason())
        .isEqualTo("semantic_below_floor");
  }

  @Test
  @DisplayName("명시 route term이 없어도 semantic과 lexical evidence가 충분하면 CONFIDENT를 허용한다")
  void should_allowAutoRun_when_semanticAndLexicalEvidenceAreStrongWithoutRouteTerms() {
    givenSession();
    given(profileRepository.countActiveProfiles(101L)).willReturn(1);
    given(embeddingClient.embed(anyString(), eq(EmbeddingInputType.SEARCH_QUERY)))
        .willReturn(vector(1.0f, 0.0f));
    given(profileRepository.findNearestActive(eq(101L), anyString(), anyString(), eq(30)))
        .willReturn(
            List.of(
                candidate(
                    20L,
                    10L,
                    "refund_request",
                    "환불 요청",
                    "refund_flow",
                    "환불 접수",
                    0.99,
                    "{}",
                    "{\"workflowReplayFitness\":0.90,\"workflowPrecision\":0.80,"
                        + "\"workflowConfidence\":0.90}")));

    WorkflowMatchResult result = service.match(1L, "환불하고 싶어요", "");

    assertThat(result.status()).isEqualTo("CONFIDENT");
    assertThat(result.candidates().getFirst().autoRunEligible()).isTrue();
    assertThat(result.candidates().getFirst().autoRunBlockReason()).isNull();
  }

  @Test
  @DisplayName("top 후보 간 margin이 좁으면 혼동 유형을 남기고 확인 질문으로 내린다")
  void should_markConfusionType_when_candidatesAreTooClose() {
    givenSession();
    given(profileRepository.countActiveProfiles(101L)).willReturn(2);
    given(embeddingClient.embed(anyString(), eq(EmbeddingInputType.SEARCH_QUERY)))
        .willReturn(vector(1.0f, 0.0f));
    given(profileRepository.findNearestActive(eq(101L), anyString(), anyString(), eq(30)))
        .willReturn(
            List.of(
                candidateWithSignals(
                    20L,
                    10L,
                    "refund_request",
                    "환불 요청",
                    "refund_flow",
                    "환불 접수",
                    0.90,
                    0.10,
                    0.50,
                    "{\"optionalTerms\":[\"환불\"]}",
                    "{\"workflowReplayFitness\":0.90,\"workflowPrecision\":0.80}"),
                candidateWithSignals(
                    21L,
                    10L,
                    "refund_request",
                    "환불 요청",
                    "refund_review_flow",
                    "환불 검토",
                    0.89,
                    0.10,
                    0.50,
                    "{\"optionalTerms\":[\"환불\"]}",
                    "{\"workflowReplayFitness\":0.90,\"workflowPrecision\":0.80}")));

    WorkflowMatchResult result = service.match(1L, "환불하고 싶어요", "");

    assertThat(result.status()).isEqualTo("AMBIGUOUS");
    assertThat(result.candidates().getFirst().confusionType())
        .isEqualTo("same_intent_workflow_overlap");
    verify(decisionRepository)
        .record(
            eq(1L),
            eq(101L),
            eq(null),
            eq(null),
            eq("AMBIGUOUS"),
            eq(result.candidates().getFirst().confidence()),
            anyString(),
            eq("profile-v1"),
            eq("bedrock"),
            eq("cohere.embed-multilingual-v3"),
            eq("ap-northeast-1"),
            anyString(),
            org.mockito.ArgumentMatchers.contains("same_intent_workflow_overlap"),
            org.mockito.ArgumentMatchers.contains("same_intent_workflow_overlap"),
            eq("confusion_same_intent_workflow_overlap"));
  }

  @Test
  @DisplayName("active profile이 없으면 UNKNOWN과 profile_missing audit을 남긴다")
  void should_returnUnknown_when_profileMissing() {
    givenSession();
    given(profileRepository.countActiveProfiles(101L)).willReturn(0);

    WorkflowMatchResult result = service.match(1L, "환불하고 싶어요", "");

    assertThat(result.status()).isEqualTo("UNKNOWN");
    verify(decisionRepository)
        .record(
            eq(1L),
            eq(101L),
            eq(null),
            eq(null),
            eq("UNKNOWN"),
            eq(0.0),
            anyString(),
            eq(null),
            eq("bedrock"),
            eq("cohere.embed-multilingual-v3"),
            eq("ap-northeast-1"),
            anyString(),
            eq("{}"),
            eq("[]"),
            eq("profile_missing"));
  }

  private void givenSession() {
    ChatSession session = ChatSession.create(10L, 101L, ChatSessionStatus.OPEN, "WEB", "{}");
    ReflectionTestUtils.setField(session, "id", 1L);
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
  }

  private WorkflowMatchingProfileCandidate candidate(
      Long workflowDefinitionId,
      Long intentDefinitionId,
      String intentCode,
      String intentName,
      String workflowCode,
      String workflowName,
      double semanticScore,
      String routeConditionJson,
      String workflowMetaJson) {
    return candidateWithSignals(
        workflowDefinitionId,
        intentDefinitionId,
        intentCode,
        intentName,
        workflowCode,
        workflowName,
        semanticScore,
        0.0,
        0.50,
        routeConditionJson,
        workflowMetaJson);
  }

  private WorkflowMatchingProfileCandidate candidateWithSignals(
      Long workflowDefinitionId,
      Long intentDefinitionId,
      String intentCode,
      String intentName,
      String workflowCode,
      String workflowName,
      double semanticScore,
      double lexicalSearchScore,
      double operationalPriorScore,
      String routeConditionJson,
      String workflowMetaJson) {
    return new WorkflowMatchingProfileCandidate(
        workflowDefinitionId,
        workflowDefinitionId,
        intentDefinitionId,
        workflowCode,
        workflowName,
        intentCode,
        intentName,
        "{}",
        "profile-v1",
        "환불 요청 배송지 변경",
        routeConditionJson,
        workflowMetaJson,
        "{\"isPrimary\":true}",
        "{}",
        "bedrock",
        "cohere.embed-multilingual-v3",
        "ap-northeast-1",
        semanticScore,
        lexicalSearchScore,
        operationalPriorScore);
  }

  private WorkflowMatchingProfileCandidate candidateWithEntryCondition(
      Long workflowDefinitionId,
      Long intentDefinitionId,
      String intentCode,
      String intentName,
      String workflowCode,
      String workflowName,
      double semanticScore,
      String intentEntryConditionJson,
      String routeConditionJson,
      String workflowMetaJson) {
    WorkflowMatchingProfileCandidate candidate =
        candidateWithSignals(
            workflowDefinitionId,
            intentDefinitionId,
            intentCode,
            intentName,
            workflowCode,
            workflowName,
            semanticScore,
            0.0,
            0.50,
            routeConditionJson,
            workflowMetaJson);
    return new WorkflowMatchingProfileCandidate(
        candidate.profileId(),
        candidate.workflowDefinitionId(),
        candidate.intentDefinitionId(),
        candidate.workflowCode(),
        candidate.workflowName(),
        candidate.intentCode(),
        candidate.intentName(),
        intentEntryConditionJson,
        candidate.profileVersion(),
        candidate.profileText(),
        candidate.routeConditionJson(),
        candidate.workflowMetaJson(),
        candidate.qualityJson(),
        candidate.sourceJson(),
        candidate.embeddingProvider(),
        candidate.embeddingModel(),
        candidate.embeddingRegion(),
        candidate.semanticScore(),
        candidate.lexicalSearchScore(),
        candidate.operationalPriorScore());
  }

  private float[] vector(float first, float second) {
    float[] vector = new float[VectorUtils.COHERE_EMBEDDING_DIMENSION];
    vector[0] = first;
    vector[1] = second;
    return vector;
  }

  private EmbeddingProperties embeddingProperties() {
    return new EmbeddingProperties(
        "bedrock",
        true,
        "cohere.embed-multilingual-v3",
        "ap-northeast-1",
        Duration.ofSeconds(5),
        Duration.ofSeconds(30),
        Duration.ofMinutes(15),
        Duration.ofMinutes(5),
        30,
        0.70,
        0.72,
        0.55,
        0.10,
        0.65,
        0.50,
        0.30);
  }
}
