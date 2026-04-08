package com.init.workflowruntime.application.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/** 상담사가 메시지를 전송할 때 사용하는 요청 DTO 클래스입니다. 메시지 본문과 상담사 전용 노트 여부 정보를 담습니다. */
@JsonIgnoreProperties(ignoreUnknown = true)
public class SendMessageRequest {
  /** 메시지 본문 내용 */
  private String content;

  /** 상담사 전용 노트 여부 */
  @JsonProperty("isNote")
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

  public void setNote(boolean note) {
    isNote = note;
  }
}
