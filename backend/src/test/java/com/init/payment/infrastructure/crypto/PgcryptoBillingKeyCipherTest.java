package com.init.payment.infrastructure.crypto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

import com.init.payment.infrastructure.config.TossApiProperties;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("PgcryptoBillingKeyCipher")
class PgcryptoBillingKeyCipherTest {

  @Mock EntityManager entityManager;

  private PgcryptoBillingKeyCipher cipher(String encKey) {
    TossApiProperties props = new TossApiProperties(null, null, encKey);
    return new PgcryptoBillingKeyCipher(entityManager, props);
  }

  @Test
  @DisplayName("암호화할 평문이 공백이면 IllegalArgumentException")
  void encrypt_blankPlaintext_throws() {
    assertThatThrownBy(() -> cipher("my-key").encrypt(""))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("복호화할 암호문이 null이면 IllegalArgumentException")
  void decrypt_nullCiphertext_throws() {
    assertThatThrownBy(() -> cipher("my-key").decrypt(null))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("복호화할 암호문이 비어있으면 IllegalArgumentException")
  void decrypt_emptyCiphertext_throws() {
    assertThatThrownBy(() -> cipher("my-key").decrypt(new byte[0]))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("암호화 키가 null이면 IllegalStateException")
  void encrypt_nullKey_throws() {
    Query query = mock(Query.class);
    given(entityManager.createNativeQuery(any())).willReturn(query);
    given(query.setParameter(anyString(), any())).willReturn(query);

    assertThatThrownBy(() -> cipher(null).encrypt("plain-billing-key"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("TOSS_BILLING_KEY_ENCRYPTION_KEY");
  }

  @Test
  @DisplayName("암호화 키가 공백이면 IllegalStateException")
  void encrypt_blankKey_throws() {
    Query query = mock(Query.class);
    given(entityManager.createNativeQuery(any())).willReturn(query);
    given(query.setParameter(anyString(), any())).willReturn(query);

    assertThatThrownBy(() -> cipher("  ").encrypt("plain-billing-key"))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  @DisplayName("pgp_sym_encrypt 네이티브 쿼리를 EntityManager에 위임한다")
  void encrypt_delegates_to_entityManager() {
    Query query = mock(Query.class);
    given(entityManager.createNativeQuery(contains("pgp_sym_encrypt"))).willReturn(query);
    given(query.setParameter(anyString(), any())).willReturn(query);
    given(query.getSingleResult()).willReturn(new byte[] {1, 2, 3});

    byte[] result = cipher("my-key").encrypt("plain-billing-key");

    assertThat(result).isEqualTo(new byte[] {1, 2, 3});
  }

  @Test
  @DisplayName("pgp_sym_decrypt byte[] 결과를 UTF-8 문자열로 반환한다")
  void decrypt_byteArrayResult_returnsString() {
    Query query = mock(Query.class);
    given(entityManager.createNativeQuery(contains("pgp_sym_decrypt"))).willReturn(query);
    given(query.setParameter(anyString(), any())).willReturn(query);
    given(query.getSingleResult()).willReturn("plain".getBytes(StandardCharsets.UTF_8));

    String result = cipher("my-key").decrypt(new byte[] {1, 2, 3});

    assertThat(result).isEqualTo("plain");
  }

  @Test
  @DisplayName("pgp_sym_decrypt String 결과를 그대로 반환한다")
  void decrypt_stringResult_returnsAsIs() {
    Query query = mock(Query.class);
    given(entityManager.createNativeQuery(contains("pgp_sym_decrypt"))).willReturn(query);
    given(query.setParameter(anyString(), any())).willReturn(query);
    given(query.getSingleResult()).willReturn("plain-string");

    String result = cipher("my-key").decrypt(new byte[] {1, 2, 3});

    assertThat(result).isEqualTo("plain-string");
  }
}
