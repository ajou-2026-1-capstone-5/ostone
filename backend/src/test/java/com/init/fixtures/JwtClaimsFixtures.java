package com.init.fixtures;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import java.time.Instant;
import java.util.Date;

public final class JwtClaimsFixtures {

  private static final Instant FIXED_ACCESS_TOKEN_EXPIRATION =
      Instant.parse("2099-01-01T00:00:00Z");

  private JwtClaimsFixtures() {}

  public static Claims accessClaims(String subject, String role) {
    return Jwts.claims()
        .subject(subject)
        .add("type", "access")
        .add("role", role)
        .expiration(Date.from(FIXED_ACCESS_TOKEN_EXPIRATION))
        .build();
  }
}
