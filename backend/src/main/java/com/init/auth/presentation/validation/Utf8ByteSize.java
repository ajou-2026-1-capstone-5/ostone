package com.init.auth.presentation.validation;

import static java.lang.annotation.ElementType.FIELD;
import static java.lang.annotation.ElementType.PARAMETER;
import static java.lang.annotation.ElementType.RECORD_COMPONENT;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;

@Documented
@Constraint(validatedBy = Utf8ByteSizeValidator.class)
@Target({FIELD, PARAMETER, RECORD_COMPONENT})
@Retention(RUNTIME)
public @interface Utf8ByteSize {

  String message() default "UTF-8 바이트 길이가 허용 범위를 벗어났습니다.";

  Class<?>[] groups() default {};

  Class<? extends Payload>[] payload() default {};

  int min() default 0;

  int max() default Integer.MAX_VALUE;
}
