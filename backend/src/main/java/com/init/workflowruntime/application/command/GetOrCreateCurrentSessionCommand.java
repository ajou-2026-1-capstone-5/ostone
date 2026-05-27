package com.init.workflowruntime.application.command;

import com.init.shared.application.exception.BadRequestException;

public record GetOrCreateCurrentSessionCommand(Long workspaceId, Long userId, String customerName) {
  public GetOrCreateCurrentSessionCommand {
    if (customerName == null || customerName.isBlank()) {
      throw new BadRequestException("VALIDATION_ERROR", "customerName must not be blank");
    }
    customerName = customerName.trim();
  }
}
