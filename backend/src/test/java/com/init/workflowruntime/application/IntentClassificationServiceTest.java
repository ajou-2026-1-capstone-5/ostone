package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.workflowruntime.application.dto.IntentClassificationResult;
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
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("IntentClassificationService")
class IntentClassificationServiceTest {

  @Mock private ChatSessionRepository chatSessionRepository;
  @Mock private IntentDefinitionRepository intentDefinitionRepository;

  private IntentClassificationService service;

  @BeforeEach
  void setUp() {
    service = new IntentClassificationService(chatSessionRepository, intentDefinitionRepository);
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

    IntentClassificationResult result = service.classify(1L, "환불하고 싶어요", "");

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

    IntentClassificationResult result = service.classify(1L, "변경하고 싶어요", "");

    assertThat(result.status()).isEqualTo("AMBIGUOUS");
    assertThat(result.candidates()).hasSize(2);
    assertThat(result.confirmationQuestion()).contains("중 어떤 문의");
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

    IntentClassificationResult result = service.classify(1L, "환불하고 싶어요", "");

    assertThat(result.status()).isEqualTo("UNKNOWN");
    assertThat(result.candidates()).isEmpty();
  }

  private void givenSession() {
    ChatSession session = ChatSession.create(10L, 101L, ChatSessionStatus.OPEN, "WEB", "{}");
    ReflectionTestUtils.setField(session, "id", 1L);
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
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
