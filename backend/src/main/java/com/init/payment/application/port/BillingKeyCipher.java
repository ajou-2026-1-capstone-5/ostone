package com.init.payment.application.port;

/**
 * billingKey 암복호화 port (U-002). 운영 구현은 PostgreSQL pgcrypto 네이티브 쿼리를 사용한다. 평문 billingKey는 호출부 메모리에서만
 * 일시 사용하고 도메인/로그/응답에 노출하지 않는다.
 */
public interface BillingKeyCipher {

  byte[] encrypt(String plaintext);

  String decrypt(byte[] ciphertext);
}
