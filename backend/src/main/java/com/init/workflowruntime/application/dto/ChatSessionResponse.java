package com.init.workflowruntime.application.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.init.workflowruntime.domain.ChatSession;
import java.time.OffsetDateTime;

/** 상담 세션 요약 정보를 전달하는 응답 DTO 클래스입니다. 세션 ID, 현재 상태, 채널, 시작 시각 등의 정보를 포함합니다. */
@JsonIgnoreProperties(ignoreUnknown = true)
public class ChatSessionResponse {
  private Long id;
  private String status;
  private String channel;
  private String metaJson;
  private OffsetDateTime startedAt;

  /**
   * ChatSession 엔티티를 ChatSessionResponse DTO로 변환합니다.
   *
   * @param session 변환할 세션 엔티티
   * @return 변환된 응답 DTO
   */
  public static ChatSessionResponse from(ChatSession session) {
    ChatSessionResponse resp = new ChatSessionResponse();
    resp.id = session.getId();
    resp.status = session.getStatus() != null ? session.getStatus().name() : null;
    resp.channel = session.getChannel();
    resp.metaJson = session.getMetaJson();
    resp.startedAt = session.getStartedAt();
    return resp;
  }

  public Long getId() {
    return id;
  }

  public String getStatus() {
    return status;
  }

  public String getChannel() {
    return channel;
  }

  public String getMetaJson() {
    return metaJson;
  }

  public OffsetDateTime getStartedAt() {
    return startedAt;
  }

  // Setters
  public void setId(Long id) {
    this.id = id;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public void setChannel(String channel) {
    this.channel = channel;
  }

  public void setMetaJson(String metaJson) {
    this.metaJson = metaJson;
  }

  public void setStartedAt(OffsetDateTime startedAt) {
    this.startedAt = startedAt;
  }
}
