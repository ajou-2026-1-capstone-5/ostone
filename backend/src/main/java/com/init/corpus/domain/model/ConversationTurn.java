package com.init.corpus.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.OffsetDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(
    name = "conversation_turn",
    schema = "corpus",
    uniqueConstraints = @UniqueConstraint(columnNames = {"conversation_id", "turn_index"}))
public class ConversationTurn {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "conversation_id", nullable = false)
  private Long conversationId;

  @Column(name = "turn_index", nullable = false)
  private int turnIndex;

  @Column(name = "speaker_role", nullable = false, length = 50)
  private String speakerRole;

  @Column(name = "message_text", nullable = false, columnDefinition = "text")
  private String messageText;

  @Column(name = "redacted_text", columnDefinition = "text")
  private String redactedText;

  @Column(name = "event_time")
  private OffsetDateTime eventTime;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "meta_json", nullable = false)
  private String metaJson;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  protected ConversationTurn() {}

  public static ConversationTurn create(
      Long conversationId,
      int turnIndex,
      String speakerRole,
      String messageText,
      OffsetDateTime eventTime) {
    ConversationTurn turn = new ConversationTurn();
    turn.conversationId = conversationId;
    turn.turnIndex = turnIndex;
    turn.speakerRole = speakerRole;
    turn.messageText = messageText;
    turn.eventTime = eventTime;
    turn.metaJson = "{}";
    return turn;
  }

  @PrePersist
  protected void onPersist() {
    this.createdAt = OffsetDateTime.now();
  }

  public Long getId() {
    return id;
  }
}
