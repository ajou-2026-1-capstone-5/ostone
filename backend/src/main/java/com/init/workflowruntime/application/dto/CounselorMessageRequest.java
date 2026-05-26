package com.init.workflowruntime.application.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class CounselorMessageRequest {

  @NotNull private Long sessionId;

  @NotBlank private String content;

  @JsonProperty("isNote")
  private boolean isNote;

  public Long getSessionId() {
    return sessionId;
  }

  public void setSessionId(Long sessionId) {
    this.sessionId = sessionId;
  }

  public String getContent() {
    return content;
  }

  public void setContent(String content) {
    this.content = content;
  }

  public boolean isNote() {
    return isNote;
  }

  public void setNote(boolean isNote) {
    this.isNote = isNote;
  }
}
