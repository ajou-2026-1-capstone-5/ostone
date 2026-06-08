package com.init.workflowruntime.application;

import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.chatSessionWithId;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.workflowruntime.application.command.IntentClassificationCommand;
import com.init.workflowruntime.application.dto.IntentClassificationResult;
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
