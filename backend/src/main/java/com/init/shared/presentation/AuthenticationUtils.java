package com.init.shared.presentation;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;

public final class AuthenticationUtils {

  private AuthenticationUtils() {}

  public static Long getUserId(Authentication authentication) {
    if (authentication == null) {
      throw new AuthenticationCredentialsNotFoundException("Authentication must not be null");
    }
    Object principal = authentication.getPrincipal();
    if (principal == null) {
      throw new AuthenticationCredentialsNotFoundException(
          "Authentication principal must not be null");
    }
    if (!(principal instanceof Long)) {
      throw new AccessDeniedException(
          "Authentication principal must be of type Long, but was: "
              + principal.getClass().getName());
    }
    return (Long) principal;
  }
}
