package com.init.workflowruntime.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** 상담 시스템에서 개별 대화 세션을 나타내는 엔티티 클래스입니다. 상담의 시작, 종료, 현재 상태 및 채널 정보를 관리합니다. */
@Entity
@Table(name = "chat_session", schema = "runtime")
public class ChatSession {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "workspace_id", nullable = false)
  private Long workspaceId;

  @Column(name = "domain_pack_version_id", nullable = false)
  private Long domainPackVersionId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private ChatSessionStatus status;

  @Column(nullable = false)
  private String channel;

  @Column(name = "started_by")
  private Long startedBy;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "meta_json", nullable = false)
  private String metaJson;

  @Column(name = "started_at", nullable = false, updatable = false)
  private OffsetDateTime startedAt;

  @Column(name = "ended_at")
  private OffsetDateTime endedAt;

  protected ChatSession() {}

  public static ChatSession create(
      Long workspaceId,
      Long domainPackVersionId,
      ChatSessionStatus status,
      String channel,
      String metaJson) {
    ChatSession session = new ChatSession();
    session.workspaceId = workspaceId;
    session.domainPackVersionId = domainPackVersionId;
    session.status = status;
    session.channel = channel;
    session.metaJson = metaJson != null ? metaJson : "{}";
    return session;
  }

  @PrePersist
  protected void onPersist() {
    this.startedAt = OffsetDateTime.now();
  }

  public Long getId() {
    return id;
  }

  public Long getWorkspaceId() {
    return workspaceId;
  }

  public Long getDomainPackVersionId() {
    return domainPackVersionId;
  }

  public ChatSessionStatus getStatus() {
    return status;
  }

  public String getChannel() {
    return channel;
  }

  public Long getStartedBy() {
    return startedBy;
  }

  public String getMetaJson() {
    return metaJson;
  }

  public OffsetDateTime getStartedAt() {
    return startedAt;
  }

  public OffsetDateTime getEndedAt() {
    return endedAt;
  }

  public void activate() {
    if (this.status != ChatSessionStatus.OPEN) {
      throw new IllegalStateException("activate() requires status OPEN but was " + this.status);
    }
    this.status = ChatSessionStatus.ACTIVE;
  }

  public void resolve() {
    if (this.status != ChatSessionStatus.ACTIVE) {
      throw new IllegalStateException("resolve() requires status ACTIVE but was " + this.status);
    }
    this.status = ChatSessionStatus.RESOLVED;
  }

  public void reopen() {
    if (this.status != ChatSessionStatus.RESOLVED) {
      throw new IllegalStateException("reopen() requires status RESOLVED but was " + this.status);
    }
    this.status = ChatSessionStatus.OPEN;
    this.endedAt = null;
  }

  /** 세션을 종료하고 상태를 COMPLETED로 변경하며 종료 시각을 기록합니다. */
  public void closeSession() {
    this.status = ChatSessionStatus.COMPLETED;
    this.endedAt = OffsetDateTime.now();
  }
}
