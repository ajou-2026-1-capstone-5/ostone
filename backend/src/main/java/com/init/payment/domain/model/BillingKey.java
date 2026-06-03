package com.init.payment.domain.model;

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

/**
 * billingKey aggregate. {@code billingKeyEncrypted}는 pgcrypto로 암호화된 bytea만 보유한다 (U-002). 평문
 * billingKey는 도메인 객체에 저장하지 않으며, 정기결제 호출 직전 cipher로 복호화하여 메모리에서만 일시 사용한다.
 */
@Entity
@Table(name = "billing_key", schema = "payment")
public class BillingKey {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "workspace_id", nullable = false)
  private Long workspaceId;

  @Column(name = "customer_key", nullable = false)
  private String customerKey;

  @Column(name = "billing_key_encrypted", nullable = false)
  private byte[] billingKeyEncrypted;

  @Column(name = "card_company")
  private String cardCompany;

  @Column(name = "card_number_masked")
  private String cardNumberMasked;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false)
  private BillingKeyStatus status;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  protected BillingKey() {}

  public static BillingKey create(
      Long workspaceId,
      String customerKey,
      byte[] billingKeyEncrypted,
      String cardCompany,
      String cardNumberMasked) {
    if (workspaceId == null) {
      throw new IllegalArgumentException("workspaceId must not be null");
    }
    if (customerKey == null || customerKey.isBlank()) {
      throw new IllegalArgumentException("customerKey must not be blank");
    }
    if (billingKeyEncrypted == null || billingKeyEncrypted.length == 0) {
      throw new IllegalArgumentException("billingKeyEncrypted must not be empty");
    }

    BillingKey billingKey = new BillingKey();
    billingKey.workspaceId = workspaceId;
    billingKey.customerKey = customerKey;
    billingKey.billingKeyEncrypted = billingKeyEncrypted.clone();
    billingKey.cardCompany = cardCompany;
    billingKey.cardNumberMasked = cardNumberMasked;
    billingKey.status = BillingKeyStatus.ACTIVE;
    return billingKey;
  }

  public void revoke() {
    this.status = BillingKeyStatus.DELETED;
  }

  public boolean isActive() {
    return status == BillingKeyStatus.ACTIVE;
  }

  public byte[] getBillingKeyEncrypted() {
    return billingKeyEncrypted.clone();
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

  public Long getWorkspaceId() {
    return workspaceId;
  }

  public String getCustomerKey() {
    return customerKey;
  }

  public String getCardCompany() {
    return cardCompany;
  }

  public String getCardNumberMasked() {
    return cardNumberMasked;
  }

  public BillingKeyStatus getStatus() {
    return status;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }

  public OffsetDateTime getUpdatedAt() {
    return updatedAt;
  }
}
