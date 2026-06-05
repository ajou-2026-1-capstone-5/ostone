package com.init.workflowruntime.application.matching;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("WorkflowMatchingProfileTextFactory")
class WorkflowMatchingProfileTextFactoryTest {

  private final WorkflowMatchingProfileTextFactory factory =
      new WorkflowMatchingProfileTextFactory(
          new WorkflowMatchingJsonParser(new ObjectMapper(), new SimpleMeterRegistry()));

  @Test
  @DisplayName("raw JSON dump 대신 route/evidence/quality를 구조화한 profile text를 만든다")
  void should_buildStructuredProfileText() {
    IntentDefinition intent =
        IntentDefinition.create(
            101L,
            "refund_request",
            "환불 요청",
            "고객이 결제 환불을 요청한다.",
            1,
            "{}",
            "{\"optionalTerms\":[\"결제\"]}",
            "[{\"customerPhrase\":\"환불하고 싶어요\"}]",
            "{}");
    WorkflowDefinition workflow =
        WorkflowDefinition.create(
            101L,
            "refund_flow",
            "환불 접수",
            "환불 가능 여부를 확인하고 접수한다.",
            "{\"nodes\":[{\"id\":\"start\",\"label\":\"주문 확인\"}]}",
            "start",
            "[]",
            "[{\"agentAction\":\"환불 정책 확인\"}]",
            "{\"workflowReplayFitness\":0.82,\"workflowPrecision\":0.74}",
            10L,
            true,
            "{\"requiredTerms\":[\"주문\"],\"requiredAnyTerms\":[[\"환불\",\"반품\"]],"
                + "\"optionalTerms\":[{\"terms\":[\"결제\",\"카드\"]}],\"negativeTerms\":[\"취소\"]}");

    String text = factory.build(intent, workflow);

    assertThat(text).contains("route_required_terms: 주문");
    assertThat(text).contains("route_required_any_terms: 환불, 반품");
    assertThat(text).contains("route_optional_terms: 결제, 카드");
    assertThat(text).contains("intent_entry_optional_terms: 결제");
    assertThat(text).contains("intent_customer_phrases: 환불하고 싶어요");
    assertThat(text).contains("workflow_customer_phrases: 환불 정책 확인");
    assertThat(text).contains("workflow_steps: start, 주문 확인");
    assertThat(text).contains("workflow_replay_fitness: 0.82");
    assertThat(text).contains("lexical_terms:");
  }

  @Test
  @DisplayName("profile text 생성 중 malformed JSON은 빈 객체 fallback과 metric으로 관측한다")
  void should_recordJsonFallbackMetric_when_profileJsonIsMalformed() {
    SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    WorkflowMatchingProfileTextFactory textFactory =
        new WorkflowMatchingProfileTextFactory(
            new WorkflowMatchingJsonParser(new ObjectMapper(), meterRegistry));
    IntentDefinition intent =
        IntentDefinition.create(
            101L, "refund_request", "환불 요청", "고객이 결제 환불을 요청한다.", 1, "{}", "{bad-json", "[]", "{}");
    WorkflowDefinition workflow =
        WorkflowDefinition.create(
            101L,
            "refund_flow",
            "환불 접수",
            "환불 가능 여부를 확인하고 접수한다.",
            "{}",
            "start",
            "[]",
            "[]",
            "{}",
            10L,
            true,
            "{}");

    String text = textFactory.build(intent, workflow);

    assertThat(text).contains("intent_code: refund_request");
    assertThat(
            meterRegistry
                .counter(
                    "workflow_matching.json_fallback", "source", "profile_intent_entry_condition")
                .count())
        .isEqualTo(1.0);
  }
}
