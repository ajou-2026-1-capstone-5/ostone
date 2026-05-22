package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.shared.application.exception.BadRequestException;
import com.init.workflowruntime.application.WorkflowConditionEvaluator.ConditionContext;
import com.init.workflowruntime.application.WorkflowConditionEvaluator.ConditionEvaluation;
import com.init.workflowruntime.application.WorkflowRuntimeGraph.RuntimeEdge;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("WorkflowConditionEvaluator")
class WorkflowConditionEvaluatorTest {

  private final ObjectMapper objectMapper = new ObjectMapper();

  @Test
  @DisplayName("evaluate: missing condition은 match되지 않는다")
  void shouldNotMatchWhenConditionMissing() {
    ConditionEvaluation result = evaluate(null, "{}", "{}", "{}");

    assertThat(result.matched()).isFalse();
    assertThat(result.defaultCondition()).isFalse();
  }

  @Test
  @DisplayName("evaluate: always/default 조건을 구분한다")
  void shouldEvaluateAlwaysAndDefaultConditions() {
    ConditionEvaluation always = evaluate("{\"type\":\"always\"}", "{}", "{}", "{}");
    ConditionEvaluation defaultCondition = evaluate("{\"type\":\"default\"}", "{}", "{}", "{}");

    assertThat(always.matched()).isTrue();
    assertThat(always.defaultCondition()).isFalse();
    assertThat(defaultCondition.matched()).isFalse();
    assertThat(defaultCondition.defaultCondition()).isTrue();
    assertThat(WorkflowConditionEvaluator.isDefaultCondition(read("{\"type\":\"default\"}")))
        .isTrue();
  }

  @Test
  @DisplayName("evaluate: slot 조건은 공백/빈 배열/빈 객체를 missing으로 판단한다")
  void shouldEvaluateSlotPresenceByMeaningfulValue() {
    String slotValues =
        """
        {
          "reservation_no": "R-1234",
          "blank": " ",
          "emptyItems": [],
          "emptyObject": {},
          "confirmed": true
        }
        """;

    assertThat(
            evaluate("{\"type\":\"slot_present\",\"slotCode\":\"reservation_no\"}", slotValues)
                .matched())
        .isTrue();
    assertThat(evaluate("{\"type\":\"slot_present\",\"slotCode\":\"blank\"}", slotValues).matched())
        .isFalse();
    assertThat(
            evaluate("{\"type\":\"slot_missing\",\"slotCode\":\"emptyItems\"}", slotValues)
                .matched())
        .isTrue();
    assertThat(
            evaluate("{\"type\":\"slot_missing\",\"slotCode\":\"emptyObject\"}", slotValues)
                .matched())
        .isTrue();
    assertThat(
            evaluate("{\"type\":\"slot_present\",\"slotCode\":\"confirmed\"}", slotValues)
                .matched())
        .isTrue();
  }

  @Test
  @DisplayName("evaluate: slot_equals는 JSON 값 동등성을 비교한다")
  void shouldEvaluateSlotEqualsByJsonValue() {
    String slotValues = "{\"count\":3,\"decision\":\"approve\"}";

    assertThat(
            evaluate("{\"type\":\"slot_equals\",\"slotCode\":\"count\",\"value\":3}", slotValues)
                .matched())
        .isTrue();
    assertThat(
            evaluate(
                    "{\"type\":\"slot_equals\",\"slotCode\":\"count\",\"value\":\"3\"}", slotValues)
                .matched())
        .isFalse();
    assertThat(
            evaluate("{\"type\":\"slot_equals\",\"slotCode\":\"missing\",\"value\":3}", slotValues)
                .matched())
        .isFalse();
    assertThat(
            evaluate("{\"type\":\"slot_equals\",\"slotCode\":\"decision\"}", slotValues).matched())
        .isFalse();
  }

  @Test
  @DisplayName("evaluate: all/any는 중첩 조건을 평가하고 default 조건은 match로 취급하지 않는다")
  void shouldEvaluateNestedConditions() {
    String slotValues = "{\"reservation_no\":\"R-1234\",\"vip\":true}";

    assertThat(
            evaluate(
                    """
                    {
                      "type": "all",
                      "conditions": [
                        {"type": "slot_present", "slotCode": "reservation_no"},
                        {"type": "slot_equals", "slotCode": "vip", "value": true}
                      ]
                    }
                    """,
                    slotValues)
                .matched())
        .isTrue();
    assertThat(
            evaluate(
                    """
                    {
                      "type": "all",
                      "conditions": [
                        {"type": "slot_present", "slotCode": "reservation_no"},
                        {"type": "default"}
                      ]
                    }
                    """,
                    slotValues)
                .matched())
        .isFalse();
    assertThat(
            evaluate(
                    """
                    {
                      "type": "any",
                      "conditions": [
                        {"type": "default"},
                        {"type": "slot_present", "slotCode": "missing"},
                        {"type": "slot_equals", "slotCode": "vip", "value": true}
                      ]
                    }
                    """,
                    slotValues)
                .matched())
        .isTrue();
  }

  @Test
  @DisplayName("evaluate: policy_hit은 snapshot 내부의 policyCode/code를 재귀 탐색한다")
  void shouldEvaluatePolicyHitFromSnapshot() {
    String policySnapshot =
        """
        {
          "hits": [{"policyCode": "refund_policy"}],
          "policyHits": [{"code": "deadline_policy"}]
        }
        """;

    assertThat(
            evaluate(
                    "{\"type\":\"policy_hit\",\"policyCode\":\"refund_policy\"}",
                    "{}",
                    policySnapshot,
                    "{}")
                .matched())
        .isTrue();
    assertThat(
            evaluate(
                    "{\"type\":\"policy_hit\",\"policyCode\":\"deadline_policy\"}",
                    "{}",
                    policySnapshot,
                    "{}")
                .matched())
        .isTrue();
    assertThat(
            evaluate(
                    "{\"type\":\"policy_hit\",\"policyCode\":\"missing_policy\"}",
                    "{}",
                    policySnapshot,
                    "{}")
                .matched())
        .isFalse();
  }

  @Test
  @DisplayName("evaluate: risk_level_gte는 snapshot 내 최대 risk level을 비교한다")
  void shouldEvaluateRiskLevelGteFromSnapshot() {
    String riskSnapshot =
        """
        {
          "riskHits": [
            {"riskLevel": "LOW"},
            {"level": "HIGH"}
          ]
        }
        """;

    assertThat(
            evaluate(
                    "{\"type\":\"risk_level_gte\",\"riskLevel\":\"MEDIUM\"}",
                    "{}",
                    "{}",
                    riskSnapshot)
                .matched())
        .isTrue();
    assertThat(
            evaluate(
                    "{\"type\":\"risk_level_gte\",\"riskLevel\":\"CRITICAL\"}",
                    "{}",
                    "{}",
                    riskSnapshot)
                .matched())
        .isFalse();
    assertThat(
            evaluate(
                    "{\"type\":\"risk_level_gte\",\"riskLevel\":\"LOW\"}", "{}", "{}", "\"MEDIUM\"")
                .matched())
        .isTrue();
  }

  @Test
  @DisplayName("blockedSlotCodes: edge와 단일 condition에서 부족한 slotCode를 중복 없이 반환한다")
  void shouldCollectBlockedSlotCodes() {
    ObjectNode slotValues = object("{\"reservation_no\":\"\"}");
    JsonNode condition =
        read(
            """
            {
              "type": "any",
              "conditions": [
                {"type": "slot_present", "slotCode": "reservation_no"},
                {"type": "slot_equals", "slotCode": "order_no", "value": "O-1"},
                {"type": "slot_present", "slotCode": "order_no"}
              ]
            }
            """);
    List<RuntimeEdge> edges =
        List.of(
            new RuntimeEdge("e1", "a", "b", condition),
            new RuntimeEdge("e2", "a", "c", read("{\"type\":\"default\"}")));

    assertThat(WorkflowConditionEvaluator.blockedSlotCodes(condition, slotValues))
        .containsExactlyInAnyOrder("reservation_no", "order_no");
    assertThat(WorkflowConditionEvaluator.blockedSlotCodes(edges, slotValues))
        .containsExactlyInAnyOrder("reservation_no", "order_no");
  }

  @Test
  @DisplayName("evaluate: 잘못된 condition은 BadRequestException을 던진다")
  void shouldThrowBadRequestWhenConditionInvalid() {
    assertThatThrownBy(() -> evaluate("[]", "{}", "{}", "{}"))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("condition must be an object");
    assertThatThrownBy(() -> evaluate("{\"type\":\"unknown\"}", "{}", "{}", "{}"))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("unsupported condition type");
    assertThatThrownBy(() -> evaluate("{\"type\":\"slot_present\"}", "{}", "{}", "{}"))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("slotCode is required");
    assertThatThrownBy(() -> evaluate("{\"type\":\"all\",\"conditions\":[]}", "{}", "{}", "{}"))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("conditions must be a non-empty array");
    assertThatThrownBy(
            () ->
                evaluate(
                    "{\"type\":\"risk_level_gte\",\"riskLevel\":\"URGENT\"}", "{}", "{}", "{}"))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("unsupported risk level");
  }

  private ConditionEvaluation evaluate(String conditionJson, String slotValuesJson) {
    return evaluate(conditionJson, slotValuesJson, "{}", "{}");
  }

  private ConditionEvaluation evaluate(
      String conditionJson,
      String slotValuesJson,
      String policySnapshotJson,
      String riskSnapshotJson) {
    return WorkflowConditionEvaluator.evaluate(
        conditionJson == null ? null : read(conditionJson),
        new ConditionContext(
            object(slotValuesJson), read(policySnapshotJson), read(riskSnapshotJson)));
  }

  private ObjectNode object(String json) {
    JsonNode node = read(json);
    assertThat(node.isObject()).isTrue();
    return (ObjectNode) node;
  }

  private JsonNode read(String json) {
    try {
      return objectMapper.readTree(json);
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException(e);
    }
  }
}
