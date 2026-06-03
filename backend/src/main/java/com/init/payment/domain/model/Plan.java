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

@Entity
@Table(name = "plan", schema = "payment")
public class Plan {

  public static final String STATUS_ACTIVE = "ACTIVE";

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "plan_key", nullable = false, unique = true)
  private String planKey;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "amount", nullable = false)
  private long amount;

  @Column(name = "currency", nullable = false)
  private String currency;

  @Enumerated(EnumType.STRING)
  @Column(name = "bill_interval", nullable = false)
  private BillingInterval billingInterval;

  @Column(name = "status", nullable = false)
  private String status;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  protected Plan() {}

  public static Plan create(
      String planKey, String name, long amount, String currency, BillingInterval billingInterval) {
    if (planKey == null || planKey.isBlank()) {
      throw new IllegalArgumentException("planKey must not be blank");
    }
    if (name == null || name.isBlank()) {
      throw new IllegalArgumentException("name must not be blank");
    }
    if (billingInterval == null) {
      throw new IllegalArgumentException("billingInterval must not be null");
    }
    Money money = Money.of(amount, currency);

    Plan plan = new Plan();
    plan.planKey = planKey;
    plan.name = name;
    plan.amount = money.amount();
    plan.currency = money.currency();
    plan.billingInterval = billingInterval;
    plan.status = STATUS_ACTIVE;
    return plan;
  }

  public Money price() {
    return Money.of(amount, currency);
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

  public String getPlanKey() {
    return planKey;
  }

  public String getName() {
    return name;
  }

  public long getAmount() {
    return amount;
  }

  public String getCurrency() {
    return currency;
  }

  public BillingInterval getBillingInterval() {
    return billingInterval;
  }

  public String getStatus() {
    return status;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }

  public OffsetDateTime getUpdatedAt() {
    return updatedAt;
  }
}
