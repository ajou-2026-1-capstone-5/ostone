package com.init.workflowruntime.application.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class SendMessageRequest {
  private String content;
  private boolean isNote;

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
