package com.init.payment.application;

import java.time.OffsetDateTime;
import java.util.UUID;

/** 결제 식별자 생성 유틸. customerKey는 워크스페이스 스코프 랜덤 UUID (U-006, PII 미포함). */
final class PaymentIdentifiers {

  private PaymentIdentifiers() {}

  static String customerKey(Long workspaceId) {
    return "wsk_" + workspaceId + "_" + uuid();
  }

  static String orderId() {
    return "ord_" + uuid();
  }

  static String idempotencyKey() {
    return uuid();
  }

  /** 동주기 중복청구 방지 키 (U-011). 같은 주기에 대해 안정적인 값. */
  static String periodKey(OffsetDateTime periodStart) {
    return periodStart.toInstant().toString();
  }

  private static String uuid() {
    return UUID.randomUUID().toString().replace("-", "");
  }
}
