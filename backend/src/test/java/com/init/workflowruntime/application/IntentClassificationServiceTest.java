package com.init.workflowruntime.application;

import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.chatSessionWithId;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.workflowruntime.application.command.IntentClassificationCommand;
import com.init.workflowruntime.application.dto.IntentClassificationResult;
import com.init.workflowruntime.application.matching.WorkflowMatchCandidate;
import com.init.workflowruntime.application.matching.WorkflowMatchResult;
import com.init.workflowruntime.application.matching.WorkflowMatchingService;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("IntentClassificationService")
class IntentClassificationServiceTest {

  @Mock private ChatSessionRepository chatSessionRepository;
  @Mock private IntentDefinitionRepository intentDefinitionRepository;
  @Mock private WorkflowMatchingService workflowMatchingService;

  private IntentClassificationService service;

  @BeforeEach
  void setUp() {
    service =
        new IntentClassificationService(
            chatSessionRepository, intentDefinitionRepository, workflowMatchingService);
  }

  @Test
  @DisplayName("classify: 명확한 발화는 단일 intent를 반환한다")
  void should_returnConfidentIntent_when_messageClearlyMatches() {
    givenSession();
    given(intentDefinitionRepository.findByDomainPackVersionId(101L))
        .willReturn(
            List.of(
                intent("refund_request", "환불 요청", "고객이 환불을 요청함", "PUBLISHED"),
                intent("change_address", "배송지 변경", "고객이 배송지를 변경함", "PUBLISHED")));

    IntentClassificationResult result = service.classify(command("환불하고 싶어요", ""));

    assertThat(result.status()).isEqualTo("CONFIDENT");
    assertThat(result.intentCode()).isEqualTo("refund_request");
    assertThat(result.candidates()).hasSize(1);
  }

  @Test
  @DisplayName("classify: 여러 intent가 비슷하게 매칭되면 confirmation 후보를 반환한다")
  void should_returnAmbiguousResult_when_multipleIntentsMatch() {
    givenSession();
    given(intentDefinitionRepository.findByDomainPackVersionId(101L))
        .willReturn(
            List.of(
                intent("change_address", "배송지 변경", "고객이 배송지를 변경함", "PUBLISHED"),
                intent("change_order", "주문 변경", "고객이 주문 내용을 변경함", "PUBLISHED")));

    IntentClassificationResult result = service.classify(command("변경하고 싶어요", ""));

    assertThat(result.status()).isEqualTo("AMBIGUOUS");
    assertThat(result.candidates()).hasSize(2);
    assertThat(result.confirmationQuestion()).contains("중 어떤 문의");
  }

  @Test
  @DisplayName("classify: 임베딩이 켜져 있어도 매칭 결과가 UNAVAILABLE이면 키워드 분류로 폴백한다")
  void should_fallBackToKeyword_when_embeddingEnabledButMatchingUnavailable() {
    // prod 처럼 임베딩 매칭이 켜져 있지만 프로필이 없어 UNAVAILABLE 이 반환되는 상황(Fix D). dead-end 대신
    // 키워드 기반 분류로 폴백해 의도를 매칭해야 한다.
    givenSession();
    given(workflowMatchingService.isEnabled()).willReturn(true);
    given(workflowMatchingService.match(any(), any(), any()))
        .willReturn(WorkflowMatchResult.unavailable());
    given(intentDefinitionRepository.findByDomainPackVersionId(101L))
        .willReturn(
            List.of(
                intent(
                    "cancellation_refund_change_policy",
                    "취소 환불 및 변경 규정",
                    "예약 취소, 환불, 변경 절차",
                    "PUBLISHED"),
                intent(
                    "travel_recommendation_consulting",
                    "여행 상품 및 숙소 추천",
                    "예산과 지역에 맞는 호텔·리조트·상품 추천",
                    "PUBLISHED")));

    IntentClassificationResult result = service.classify(command("취소하고 환불받고 싶어요", ""));

    assertThat(result.status()).isEqualTo("CONFIDENT");
    assertThat(result.intentCode()).isEqualTo("cancellation_refund_change_policy");
  }

  @Test
  @DisplayName("classify: rejected intent는 후보에서 제외한다")
  void should_excludeRejectedIntent() {
    givenSession();
    given(intentDefinitionRepository.findByDomainPackVersionId(101L))
        .willReturn(
            List.of(
                intent("legacy_refund", "레거시 환불", "고객이 환불을 요청함", "REJECTED"),
                intent("change_address", "배송지 변경", "고객이 배송지를 변경함", "PUBLISHED")));

    IntentClassificationResult result = service.classify(command("환불하고 싶어요", ""));

    assertThat(result.status()).isEqualTo("UNKNOWN");
    assertThat(result.candidates()).isEmpty();
  }

  @Test
  @DisplayName("classify: 임베딩이 CONFIDENT를 반환하면 바로 확신 결과를 반환한다")
  void should_returnConfidentFromEmbedding_when_matchIsConfident() {
    given(workflowMatchingService.isEnabled()).willReturn(true);
    WorkflowMatchCandidate candidate =
        new WorkflowMatchCandidate(
            10L,
            20L,
            "refund_policy",
            "환불 규정",
            "WF-REFUND",
            "환불 워크플로우",
            "v1",
            0.93,
            0.9,
            0.8,
            0.7,
            0.6,
            0.85,
            0.1,
            true,
            false,
            null,
            null);
    given(workflowMatchingService.match(any(), any(), any()))
        .willReturn(WorkflowMatchResult.confident(candidate));

    IntentClassificationResult result = service.classify(command("환불하고 싶어요", ""));

    assertThat(result.status()).isEqualTo("CONFIDENT");
    assertThat(result.intentCode()).isEqualTo("refund_policy");
    assertThat(result.confidence()).isEqualTo(0.93);
    assertThat(result.candidates()).hasSize(1);
    assertThat(result.candidates().get(0).intentCode()).isEqualTo("refund_policy");
  }

  @Test
  @DisplayName("classify: 임베딩이 AMBIGUOUS를 반환하면 확인 질문과 후보 목록을 반환한다")
  void should_returnAmbiguousFromEmbedding_when_matchIsAmbiguous() {
    given(workflowMatchingService.isEnabled()).willReturn(true);
    WorkflowMatchCandidate c1 =
        new WorkflowMatchCandidate(
            10L,
            20L,
            "refund_policy",
            "환불 규정",
            "WF-REFUND",
            "환불",
            "v1",
            0.75,
            0.7,
            0.6,
            0.5,
            0.4,
            0.65,
            0.0,
            true,
            false,
            null,
            null);
    WorkflowMatchCandidate c2 =
        new WorkflowMatchCandidate(
            11L,
            21L,
            "cancellation_policy",
            "취소 규정",
            "WF-CANCEL",
            "취소",
            "v1",
            0.72,
            0.7,
            0.6,
            0.5,
            0.4,
            0.65,
            0.0,
            true,
            false,
            null,
            null);
    given(workflowMatchingService.match(any(), any(), any()))
        .willReturn(WorkflowMatchResult.ambiguous("환불인가요, 취소인가요?", List.of(c1, c2)));

    IntentClassificationResult result = service.classify(command("변경하거나 취소하고 싶어요", ""));

    assertThat(result.status()).isEqualTo("AMBIGUOUS");
    assertThat(result.confirmationQuestion()).isEqualTo("환불인가요, 취소인가요?");
    assertThat(result.candidates()).hasSize(2);
  }

  @Test
  @DisplayName("classify: 임베딩이 UNKNOWN을 반환하면 키워드 폴백 없이 UNKNOWN을 반환한다")
  void should_returnUnknown_when_embeddingMatchReturnsUnknown() {
    // UNKNOWN ≠ UNAVAILABLE: UNAVAILABLE 만 키워드 폴백 트리거. UNKNOWN 은 바로 반환된다.
    given(workflowMatchingService.isEnabled()).willReturn(true);
    given(workflowMatchingService.match(any(), any(), any()))
        .willReturn(WorkflowMatchResult.unknown("입력이 불충분합니다"));

    IntentClassificationResult result = service.classify(command("음", ""));

    assertThat(result.status()).isEqualTo("UNKNOWN");
    assertThat(result.message()).isEqualTo("입력이 불충분합니다");
  }

  @Test
  @DisplayName("classify: 임베딩이 BLOCKED를 반환하면 키워드 폴백 없이 UNKNOWN 메시지를 반환한다")
  void should_returnUnknownMessage_when_embeddingMatchReturnsBlocked() {
    given(workflowMatchingService.isEnabled()).willReturn(true);
    WorkflowMatchCandidate blocked =
        new WorkflowMatchCandidate(
            10L,
            20L,
            "refund_policy",
            "환불 규정",
            "WF-REFUND",
            "환불",
            "v1",
            0.85,
            0.8,
            0.7,
            0.6,
            0.5,
            0.75,
            0.0,
            false,
            true,
            "low_replay_fitness",
            null);
    given(workflowMatchingService.match(any(), any(), any()))
        .willReturn(WorkflowMatchResult.blocked("신뢰도 미달", List.of(blocked)));

    IntentClassificationResult result = service.classify(command("환불하고 싶어요", ""));

    assertThat(result.status()).isEqualTo("UNKNOWN");
    assertThat(result.message()).isEqualTo("신뢰도 미달");
  }

  @Test
  @DisplayName("classify: @Transactional 오버라이드로 @Async 핸들러에서도 match 결과 기록이 가능하다")
  void should_handleMatchResult_when_calledWithoutOuterTransaction() {
    // @Async LlmResponseHandler 에서 아웃 트랜잭션 없이 호출될 때 발생했던 readOnly 트랜잭션
    // 제약(DML 불가) 버그를 재현하는 시나리오. classify 메서드에 @Transactional 을 추가해
    // 독립 읽기-쓰기 트랜잭션을 시작함으로써 match 의 decision 기록이 정상 동작해야 한다.
    // (단위 테스트에서 트랜잭션을 직접 검증할 수 없으므로 동작 흐름만 확인한다.)
    givenSession();
    given(workflowMatchingService.isEnabled()).willReturn(true);
    given(workflowMatchingService.match(any(), any(), any()))
        .willReturn(WorkflowMatchResult.unavailable()); // 프로덕션: 프로필 없음 → unavailable
    given(intentDefinitionRepository.findByDomainPackVersionId(101L))
        .willReturn(
            List.of(
                intent("cancellation_refund_policy", "취소 및 환불 규정", "예약 취소, 환불 절차", "PUBLISHED")));

    IntentClassificationResult result = service.classify(command("여행 상품 구매한 것을 환불하고 싶어요", ""));

    // 임베딩 매칭 프로필 없음 → 키워드 폴백 → 환불 intent 확신 매칭
    assertThat(result.status()).isEqualTo("CONFIDENT");
    assertThat(result.intentCode()).isEqualTo("cancellation_refund_policy");
  }

  @Test
  @DisplayName("classify: intent code 토큰은 더 높은 가중치를 적용한다")
  void should_applyHigherWeightToIntentCodeTokens() {
    givenSession();
    given(intentDefinitionRepository.findByDomainPackVersionId(101L))
        .willReturn(
            List.of(
                intent("refund_request", "기타", "기타", "PUBLISHED"),
                intent("refund", "환불", "환불", "PUBLISHED")));

    IntentClassificationResult result = service.classify(command("refund request", ""));

    assertThat(result.status()).isEqualTo("CONFIDENT");
    assertThat(result.intentCode()).isEqualTo("refund_request");
    assertThat(result.confidence()).isEqualTo(0.95);
  }

  private void givenSession() {
    ChatSession session = ChatSession.create(10L, 101L, ChatSessionStatus.OPEN, "WEB", "{}");
    ChatSession identifiedSession = chatSessionWithId(session, 1L);
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(identifiedSession));
  }

  private IntentClassificationCommand command(
      String latestUserMessage, String conversationContext) {
    return new IntentClassificationCommand(1L, latestUserMessage, conversationContext);
  }

  private IntentDefinition intent(String code, String name, String description, String status) {
    IntentDefinition intent =
        IntentDefinition.create(101L, code, name, description, 1, "{}", "{}", "[]", "{}");
    if (!IntentDefinition.STATUS_DRAFT.equals(status)) {
      intent.changeStatus(status);
    }
    return intent;
  }
}
