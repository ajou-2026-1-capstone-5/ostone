package com.init.auth.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Objects;

@Entity
@Table(name = "refresh_token", schema = "app")
public class RefreshToken {
  private static volatile Clock clock = Clock.systemDefaultZone();

  // 테스트용 Clock 설정 메서드 (package-private)
  static void setClock(Clock testClock) {
    java.util.Objects.requireNonNull(testClock, "testClock must not be null");
    clock = testClock;
  }

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Version
  @Column(nullable = false)
  private Long version;

  @Column(name = "user_id", nullable = false)
  private Long userId;

  @Column(name = "token_hash", nullable = false, unique = true)
  private String tokenHash;

  @Column(name = "expires_at", nullable = false)
  private OffsetDateTime expiresAt;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @Column(name = "revoked_at")
  private OffsetDateTime revokedAt;

  protected RefreshToken() {}

  public static RefreshToken create(Long userId, String tokenHash, OffsetDateTime expiresAt) {
    Objects.requireNonNull(userId, "userId must not be null");
    Objects.requireNonNull(expiresAt, "expiresAt must not be null");
    if (tokenHash == null || tokenHash.isBlank()) {
      throw new IllegalArgumentException("tokenHash must not be null or blank");
    }
    RefreshToken token = new RefreshToken();
    token.userId = userId;
    token.tokenHash = tokenHash;
    token.expiresAt = expiresAt;
    token.createdAt = OffsetDateTime.now(clock);
    return token;
  }

  public void revoke() {
    this.revokedAt = OffsetDateTime.now(clock);
  }

  public boolean isValid() {
    return revokedAt == null && expiresAt.isAfter(OffsetDateTime.now(clock));
  }

  public Long getId() {
    return id;
  }

  public Long getUserId() {
    return userId;
  }

  public String getTokenHash() {
    return tokenHash;
  }
}
