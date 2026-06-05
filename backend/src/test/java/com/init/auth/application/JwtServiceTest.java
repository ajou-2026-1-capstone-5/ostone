package com.init.auth.application;

import static org.assertj.core.api.Assertions.assertThat;

import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("JwtService")
class JwtServiceTest {

  private static final String SECRET = "test-secret-key-for-testing-purposes-only-min-32-bytes";

  @Test
  @DisplayName("generateRefreshToken: 같은 사용자에게 즉시 재발급해도 서로 다른 토큰을 생성한다")
  void shouldGenerateDifferentRefreshTokensWhenIssuedImmediatelyForSameUser() {
    // given
    JwtService jwtService = new JwtService(SECRET, 1_800_000L, 604_800_000L);

    // when
    String first = jwtService.generateRefreshToken(1L);
    String second = jwtService.generateRefreshToken(1L);

    // then
    assertThat(second).isNotEqualTo(first);
    Claims claims = jwtService.parseClaims(first);
    assertThat(claims.get("type", String.class)).isEqualTo("refresh");
    assertThat(claims.getId()).isNotBlank();
  }
}
