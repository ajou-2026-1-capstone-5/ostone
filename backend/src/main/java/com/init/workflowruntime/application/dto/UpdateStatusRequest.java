package com.init.workflowruntime.application.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;

/**
 * 상담 세션의 상태를 변경할 때 사용하는 요청 DTO 클래스입니다.
 * 변경하고자 하는 목표 상태(status) 정보를 담습니다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class UpdateStatusRequest {
  /** 변경할 상담 세션의 상태 (ACTIVE, RESOLVED, COMPLETED 등) */
  @NotBlank(message = "상담 상태는 필수 입력 항목입니다.")
  private String status;

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }
}