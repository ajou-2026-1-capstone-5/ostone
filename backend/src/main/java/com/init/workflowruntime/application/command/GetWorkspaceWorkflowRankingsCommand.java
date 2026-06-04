package com.init.workflowruntime.application.command;

import com.init.shared.application.exception.BadRequestException;
import java.time.LocalDate;
import java.util.Objects;

public record GetWorkspaceWorkflowRankingsCommand(
    Long workspaceId, Long userId, LocalDate fromDate, LocalDate toDate) {
  public GetWorkspaceWorkflowRankingsCommand {
    Objects.requireNonNull(workspaceId, "workspaceId must not be null");
    Objects.requireNonNull(userId, "userId must not be null");
    if ((fromDate == null) != (toDate == null)) {
      throw new BadRequestException(
          "INVALID_WORKFLOW_RANKING_PERIOD", "fromDate and toDate must be provided together");
    }
    if (fromDate != null && fromDate.isAfter(toDate)) {
      throw new BadRequestException(
          "INVALID_WORKFLOW_RANKING_PERIOD", "fromDate must be before or equal to toDate");
    }
  }

  public GetWorkspaceWorkflowRankingsCommand(Long workspaceId, Long userId) {
    this(workspaceId, userId, null, null);
  }
}
