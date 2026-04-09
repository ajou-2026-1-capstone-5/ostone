package com.init.fixtures;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.security.test.context.support.WithSecurityContext;

/**
 * 컨트롤러 테스트에서 Long 타입 principal을 가진 Authentication을 SecurityContext에 주입한다.
 *
 * <p>NI-1 Option B: SecurityMockMvcRequestPostProcessors.authentication()은 Spring Security 6 +
 * addFilters=false 환경에서 SecurityContextHolderFilter 미실행으로 동작하지 않으므로, @WithSecurityContext 기반
 * 어노테이션으로 대체한다.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
@WithSecurityContext(factory = WithLongPrincipalSecurityContextFactory.class)
public @interface WithLongPrincipal {
  long value() default 1L;
}
