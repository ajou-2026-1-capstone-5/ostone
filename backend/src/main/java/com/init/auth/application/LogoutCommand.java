package com.init.auth.application;

import com.init.auth.application.exception.BadRequestException;
import java.util.Objects;

public record LogoutCommand(String refreshToken) {
  public LogoutCommand {
    Objects.requireNonNull(refreshToken, "refreshToken must not be null");
    if (refreshToken.isBlank()) {
      throw new BadRequestException("refreshToken must not be blank");
    }
  }
}
