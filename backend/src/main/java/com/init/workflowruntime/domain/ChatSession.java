package com.init.workflowruntime.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

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

  @Column(nullable = false)
  private String status;

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

  public static ChatSession create(Long workspaceId, Long domainPackVersionId, String status, String channel, String metaJson) {
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

  public Long getId() { return id; }
  public Long getWorkspaceId() { return workspaceId; }
  public Long getDomainPackVersionId() { return domainPackVersionId; }
  public String getStatus() { return status; }
  public String getChannel() { return channel; }
  public Long getStartedBy() { return startedBy; }
  public String getMetaJson() { return metaJson; }
  public OffsetDateTime getStartedAt() { return startedAt; }
  public OffsetDateTime getEndedAt() { return endedAt; }

  public void closeSession() {
    this.status = "COMPLETED";
    this.endedAt = OffsetDateTime.now();
  }
}
