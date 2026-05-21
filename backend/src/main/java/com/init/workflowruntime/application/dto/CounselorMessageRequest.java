package com.init.workflowruntime.application.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class CounselorMessageRequest {

  @NotNull
  private Long sessionId;

  @NotBlank
  private String content;

  public Long getSessionId() { return sessionId; }
  public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
  public String getContent() { return content; }
  public void setContent(String content) { this.content = content; }
}
