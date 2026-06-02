package com.init.domainpack.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("DomainPackVersion")
class DomainPackVersionTest {

  @Test
  @DisplayName("activate(now)는 기존 description을 유지한다")
  void should_description유지_when_description없는activate호출() {
    DomainPackVersion version =
        DomainPackVersion.createDraft(7L, 1, 10L, null, "{}", "기존 변경사항 정리");
    OffsetDateTime now = OffsetDateTime.parse("2026-04-09T12:00:00Z");

    version.activate(now);

    assertThat(version.getLifecycleStatus()).isEqualTo(DomainPackVersion.STATUS_PUBLISHED);
    assertThat(version.getDescription()).isEqualTo("기존 변경사항 정리");
    assertThat(version.getPublishedAt()).isEqualTo(now);
    assertThat(version.getUpdatedAt()).isEqualTo(now);
  }

  @Test
  @DisplayName("activate(now, description)는 description을 trim한다")
  void should_descriptionTrim_when_description있음() {
    DomainPackVersion version = DomainPackVersion.createDraft(7L, 1, 10L, null, "{}", null);

    version.activate(OffsetDateTime.parse("2026-04-09T12:00:00Z"), "  변경사항 정리  ");

    assertThat(version.getDescription()).isEqualTo("변경사항 정리");
  }

  @Test
  @DisplayName("activate(now, description)는 빈 description을 null로 정규화한다")
  void should_descriptionNull_when_description공백() {
    DomainPackVersion version =
        DomainPackVersion.createDraft(7L, 1, 10L, null, "{}", "기존 변경사항 정리");

    version.activate(OffsetDateTime.parse("2026-04-09T12:00:00Z"), "   ");

    assertThat(version.getDescription()).isNull();
  }

  @Test
  @DisplayName("activate: DRAFT가 아닌 상태에서 호출 시 IllegalStateException 발생")
  void should_예외발생_when_DRAFT아님() {
    DomainPackVersion version = DomainPackVersion.createDraft(7L, 1, 10L, null, "{}", null);
    version.activate(OffsetDateTime.parse("2026-04-09T12:00:00Z"));

    assertThatThrownBy(() -> version.activate(OffsetDateTime.parse("2026-04-09T12:01:00Z")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("DRAFT 상태");
  }
}
