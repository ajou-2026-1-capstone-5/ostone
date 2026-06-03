package com.init.payment.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Set;

/**
 * Toss 응답/웹훅 페이로드에서 민감정보(billingKey/secretKey/authKey/전체 PAN)를 제거한다 (U-012). 저장(raw_response,
 * webhook_event.payload)과 로깅 전 공통 적용한다.
 */
public final class TossPayloadMasker {

  private static final Set<String> SENSITIVE_FIELDS = Set.of("billingKey", "secretKey", "authKey");

  private TossPayloadMasker() {}

  public static String mask(JsonNode node) {
    if (node == null || node.isNull() || node.isMissingNode()) {
      return null;
    }
    return maskNode(node.deepCopy()).toString();
  }

  private static JsonNode maskNode(JsonNode node) {
    if (node instanceof ObjectNode objectNode) {
      objectNode
          .fieldNames()
          .forEachRemaining(
              field -> {
                if (SENSITIVE_FIELDS.contains(field)) {
                  objectNode.put(field, "***");
                } else if ("number".equals(field) && objectNode.get(field).isTextual()) {
                  objectNode.put(field, maskPan(objectNode.get(field).asText()));
                } else {
                  maskNode(objectNode.get(field));
                }
              });
    } else if (node.isArray()) {
      node.forEach(TossPayloadMasker::maskNode);
    }
    return node;
  }

  private static String maskPan(String pan) {
    if (pan == null || pan.length() <= 4) {
      return "****";
    }
    return "****-****-****-" + pan.substring(pan.length() - 4);
  }
}
