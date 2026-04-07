package com.init.auth.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "app_user", schema = "app")
public class AppUser {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, unique = true)
  private String email;

  @Column(nullable = false)
  private String name;

  @Column(name = "password_hash")
  private String passwordHash;

  @Column(name = "password_reset_required", nullable = false)
  private boolean passwordResetRequired;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private UserRole role;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private UserStatus status;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "profile_json")
  private String profileJson;

  @Column(name = "password_reset_token_hash")
  private String passwordResetTokenHash;

  @Column(name = "password_reset_token_expires_at")
  private OffsetDateTime passwordResetTokenExpiresAt;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  protected AppUser() {}

  public static AppUser create(String name, String email, String passwordHash) {
    if (name == null || name.isBlank()) {
      throw new IllegalArgumentException("name must not be null or blank");
    }
    if (email == null || email.isBlank()) {
      throw new IllegalArgumentException("email must not be null or blank");
    }
    if (passwordHash == null || passwordHash.isBlank()) {
      throw new IllegalArgumentException("passwordHash must not be null or blank");
    }
    AppUser user = new AppUser();
    user.name = name;
    user.email = email;
    user.passwordHash = passwordHash;
    user.role = UserRole.OPERATOR;
    user.status = UserStatus.ACTIVE;
    user.profileJson = "{}";
    return user;
  }

  @PrePersist
  protected void onPersist() {
    OffsetDateTime now = OffsetDateTime.now();
    this.createdAt = now;
    this.updatedAt = now;
  }

  @PreUpdate
  protected void onUpdate() {
    this.updatedAt = OffsetDateTime.now();
  }

  public Long getId() {
    return id;
  }

  public String getEmail() {
    return email;
  }

  public String getName() {
    return name;
  }

  public String getPasswordHash() {
    return passwordHash;
  }

  public UserRole getRole() {
    return role;
  }

  public UserStatus getStatus() {
    return status;
  }

  public boolean isPasswordResetRequired() {
    return passwordResetRequired;
  }

  public void initiatePasswordReset(String tokenHash, OffsetDateTime expiresAt) {
    if (tokenHash == null || tokenHash.isBlank()) {
      throw new IllegalArgumentException("tokenHash must not be null or blank");
    }
    if (expiresAt == null) {
      throw new IllegalArgumentException("expiresAt must not be null or blank");
    }
    this.passwordResetTokenHash = tokenHash;
    this.passwordResetTokenExpiresAt = expiresAt;
  }

  public boolean isPasswordResetTokenValid() {
    return passwordResetTokenHash != null
        && passwordResetTokenExpiresAt != null
        && OffsetDateTime.now().isBefore(passwordResetTokenExpiresAt);
  }

  public void completePasswordReset(String newPasswordHash) {
    if (newPasswordHash == null || newPasswordHash.isBlank()) {
      throw new IllegalArgumentException("newPasswordHash must not be null or blank");
    }
    this.passwordHash = newPasswordHash;
    this.passwordResetRequired = false;
    this.passwordResetTokenHash = null;
    this.passwordResetTokenExpiresAt = null;
  }
}
