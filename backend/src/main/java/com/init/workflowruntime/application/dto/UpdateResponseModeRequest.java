package com.init.workflowruntime.application.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class UpdateResponseModeRequest {

  @NotNull private Long counselorId;

  @NotBlank private String responseMode;

  public Long getCounselorId() {
    return counselorId;
  }

  public void setCounselorId(Long counselorId) {
    this.counselorId = counselorId;
  }

  public String getResponseMode() {
    return responseMode;
  }

  public void setResponseMode(String responseMode) {
    this.responseMode = responseMode;
  }
}
