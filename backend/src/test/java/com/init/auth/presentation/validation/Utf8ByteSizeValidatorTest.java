package com.init.auth.presentation.validation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("Utf8ByteSizeValidator")
class Utf8ByteSizeValidatorTest {

  @Test
  @DisplayName("isValid: UTF-8 byte length 기준으로 범위를 검사한다")
  void should_validateByUtf8ByteLength() {
    // given
    Utf8ByteSize annotation = org.mockito.Mockito.mock(Utf8ByteSize.class);
    given(annotation.min()).willReturn(8);
    given(annotation.max()).willReturn(72);

    Utf8ByteSizeValidator validator = new Utf8ByteSizeValidator();
    validator.initialize(annotation);

    // when & then
    assertThat(validator.isValid("password123", null)).isTrue();
    assertThat(validator.isValid("가".repeat(24), null)).isTrue();
    assertThat(validator.isValid("가".repeat(25), null)).isFalse();
    assertThat(validator.isValid("short", null)).isFalse();
    assertThat(validator.isValid(null, null)).isTrue();
  }

  @Test
  @DisplayName("initialize: min이 음수이면 예외를 던진다")
  void should_throw_when_min음수() {
    // given
    Utf8ByteSize annotation = org.mockito.Mockito.mock(Utf8ByteSize.class);
    given(annotation.min()).willReturn(-1);
    given(annotation.max()).willReturn(72);

    Utf8ByteSizeValidator validator = new Utf8ByteSizeValidator();

    // when & then
    assertThatThrownBy(() -> validator.initialize(annotation))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("min must be >= 0");
  }

  @Test
  @DisplayName("initialize: max가 min보다 작으면 예외를 던진다")
  void should_throw_when_max가min보다작음() {
    // given
    Utf8ByteSize annotation = org.mockito.Mockito.mock(Utf8ByteSize.class);
    given(annotation.min()).willReturn(10);
    given(annotation.max()).willReturn(8);

    Utf8ByteSizeValidator validator = new Utf8ByteSizeValidator();

    // when & then
    assertThatThrownBy(() -> validator.initialize(annotation))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("max must be >= min");
  }
}
