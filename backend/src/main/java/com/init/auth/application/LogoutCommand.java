package com.init.auth.application;

import com.init.auth.application.exception.BadRequestException;

public record LogoutCommand(String refreshToken) {
  public LogoutCommand {
    if (refreshToken == null || refreshToken.isBlank()) {
      throw new BadRequestException("refreshToken must not be blank");
    }
  }
}
