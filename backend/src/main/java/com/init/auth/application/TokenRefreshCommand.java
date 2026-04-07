package com.init.auth.application;

import com.init.auth.application.exception.BadRequestException;
import java.util.Objects;

public record TokenRefreshCommand(String refreshToken) {
  public TokenRefreshCommand {
    if (Objects.isNull(refreshToken) || refreshToken.isBlank()) {
      throw new BadRequestException("refreshToken must not be blank");
    }
  }
}
