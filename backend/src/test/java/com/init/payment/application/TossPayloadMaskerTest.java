package com.init.payment.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("TossPayloadMasker")
class TossPayloadMaskerTest {

  private final ObjectMapper objectMapper = new ObjectMapper();

  private JsonNode json(String raw) throws Exception {
    return objectMapper.readTree(raw);
  }

  @Test
  @DisplayName("null 노드는 null 반환")
  void mask_null_returns_null() {
    assertThat(TossPayloadMasker.mask(null)).isNull();
  }

  @Test
  @DisplayName("null JSON 노드는 null 반환")
  void mask_nullNode_returns_null() throws Exception {
    assertThat(TossPayloadMasker.mask(objectMapper.nullNode())).isNull();
  }

  @Test
  @DisplayName("missing 노드는 null 반환")
  void mask_missingNode_returns_null() throws Exception {
    JsonNode missing = json("{}").path("nonexistent");
    assertThat(TossPayloadMasker.mask(missing)).isNull();
  }

  @Test
  @DisplayName("billingKey 필드를 ***로 마스킹한다")
  void mask_removes_billingKey() throws Exception {
    String result = TossPayloadMasker.mask(json("{\"billingKey\":\"bk_test_abc\",\"amount\":1000}"));
    assertThat(result).contains("\"billingKey\":\"***\"");
    assertThat(result).doesNotContain("bk_test_abc");
    assertThat(result).contains("\"amount\":1000");
  }

  @Test
  @DisplayName("secretKey 필드를 ***로 마스킹한다")
  void mask_removes_secretKey() throws Exception {
    String result = TossPayloadMasker.mask(json("{\"secretKey\":\"sk_secret\"}"));
    assertThat(result).contains("\"secretKey\":\"***\"");
    assertThat(result).doesNotContain("sk_secret");
  }

  @Test
  @DisplayName("authKey 필드를 ***로 마스킹한다")
  void mask_removes_authKey() throws Exception {
    String result = TossPayloadMasker.mask(json("{\"authKey\":\"auth_key_val\"}"));
    assertThat(result).contains("\"authKey\":\"***\"");
    assertThat(result).doesNotContain("auth_key_val");
  }

  @Test
  @DisplayName("number 필드는 마지막 4자리만 남긴다")
  void mask_pan_preserves_last_four_digits() throws Exception {
    String result =
        TossPayloadMasker.mask(json("{\"card\":{\"number\":\"1234-5678-9012-3456\"}}"));
    assertThat(result).contains("3456");
    assertThat(result).doesNotContain("1234-5678-9012");
  }

  @Test
  @DisplayName("4자리 이하 카드번호는 ****로 마스킹한다")
  void mask_short_pan_returns_stars() throws Exception {
    String result = TossPayloadMasker.mask(json("{\"number\":\"123\"}"));
    assertThat(result).contains("\"****\"");
  }

  @Test
  @DisplayName("배열 내 객체의 민감 필드도 마스킹한다")
  void mask_array_elements() throws Exception {
    String result =
        TossPayloadMasker.mask(json("[{\"billingKey\":\"bk_1\"},{\"billingKey\":\"bk_2\"}]"));
    assertThat(result).doesNotContain("bk_1");
    assertThat(result).doesNotContain("bk_2");
    assertThat(result).contains("\"***\"");
  }

  @Test
  @DisplayName("민감하지 않은 필드는 그대로 보존한다")
  void mask_preserves_non_sensitive_fields() throws Exception {
    String result =
        TossPayloadMasker.mask(json("{\"orderId\":\"ord_123\",\"totalAmount\":29000}"));
    assertThat(result).contains("\"orderId\":\"ord_123\"");
    assertThat(result).contains("\"totalAmount\":29000");
  }

  @Test
  @DisplayName("중첩 객체의 민감 필드도 마스킹한다")
  void mask_nested_sensitive_fields() throws Exception {
    String result =
        TossPayloadMasker.mask(
            json("{\"payment\":{\"billingKey\":\"bk_nested\",\"amount\":5000}}"));
    assertThat(result).doesNotContain("bk_nested");
    assertThat(result).contains("\"billingKey\":\"***\"");
  }
}
