package com.init.workflowruntime.application.dto;

import com.init.workflowruntime.domain.ChatSessionStatus;

public enum SessionResolutionOutcome {
  RESOLVED("해결됨", ChatSessionStatus.RESOLVED, false),
  CUSTOMER_LEFT("고객 이탈", ChatSessionStatus.COMPLETED, false),
  PENDING("보류", ChatSessionStatus.RESOLVED, true),
  FOLLOW_UP_REQUIRED("후속 연락 필요", ChatSessionStatus.RESOLVED, true);

  private final String label;
  private final ChatSessionStatus defaultStatus;
  private final boolean defaultFollowUpRequired;

  SessionResolutionOutcome(
      String label, ChatSessionStatus defaultStatus, boolean defaultFollowUpRequired) {
    this.label = label;
    this.defaultStatus = defaultStatus;
    this.defaultFollowUpRequired = defaultFollowUpRequired;
  }

  public String getLabel() {
    return label;
  }

  public ChatSessionStatus getDefaultStatus() {
    return defaultStatus;
  }

  public boolean isDefaultFollowUpRequired() {
    return defaultFollowUpRequired;
  }
}
