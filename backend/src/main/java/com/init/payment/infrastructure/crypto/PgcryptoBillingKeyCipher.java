package com.init.payment.infrastructure.crypto;

import com.init.payment.application.port.BillingKeyCipher;
import com.init.payment.infrastructure.config.TossApiProperties;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * PostgreSQL pgcrypto 기반 billingKey 컬럼 암복호화 (U-002). 대칭키는 {@code TOSS_BILLING_KEY_ENCRYPTION_KEY}
 * env로만 주입되며 DB·로그에 평문 billingKey를 남기지 않는다. query-time 키가 필요하므로 JPA Converter가 아닌 네이티브 쿼리로 수행한다.
 */
@Component
public class PgcryptoBillingKeyCipher implements BillingKeyCipher {

  private final EntityManager entityManager;
  private final TossApiProperties properties;

  public PgcryptoBillingKeyCipher(EntityManager entityManager, TossApiProperties properties) {
    this.entityManager = entityManager;
    this.properties = properties;
  }

  @Override
  @Transactional(readOnly = true)
  public byte[] encrypt(String plaintext) {
    if (plaintext == null || plaintext.isBlank()) {
      throw new IllegalArgumentException("plaintext billingKey must not be blank");
    }
    Object result =
        entityManager
            .createNativeQuery("select pgp_sym_encrypt(cast(:plain as text), cast(:key as text))")
            .setParameter("plain", plaintext)
            .setParameter("key", encryptionKey())
            .getSingleResult();
    return (byte[]) result;
  }

  @Override
  @Transactional(readOnly = true)
  public String decrypt(byte[] ciphertext) {
    if (ciphertext == null || ciphertext.length == 0) {
      throw new IllegalArgumentException("ciphertext must not be empty");
    }
    Object result =
        entityManager
            .createNativeQuery("select pgp_sym_decrypt(cast(:cipher as bytea), cast(:key as text))")
            .setParameter("cipher", ciphertext)
            .setParameter("key", encryptionKey())
            .getSingleResult();
    if (result instanceof byte[] bytes) {
      return new String(bytes, StandardCharsets.UTF_8);
    }
    return (String) result;
  }

  private String encryptionKey() {
    String key = properties.billingKeyEncryptionKey();
    if (key == null || key.isBlank()) {
      throw new IllegalStateException(
          "TOSS_BILLING_KEY_ENCRYPTION_KEY가 설정되지 않았습니다. billingKey 암복호화를 수행할 수 없습니다.");
    }
    return key;
  }
}
