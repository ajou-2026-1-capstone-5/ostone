package com.init.fixtures;

import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.test.context.support.WithSecurityContextFactory;

public class WithLongPrincipalSecurityContextFactory
    implements WithSecurityContextFactory<WithLongPrincipal> {

  @Override
  public SecurityContext createSecurityContext(WithLongPrincipal annotation) {
    SecurityContext context = SecurityContextHolder.createEmptyContext();
    Authentication auth =
        new UsernamePasswordAuthenticationToken(annotation.value(), null, List.of());
    context.setAuthentication(auth);
    return context;
  }
}
