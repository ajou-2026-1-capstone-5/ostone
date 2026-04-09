package com.init.domainpack.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

@DisplayName("DomainPackVersion")
class DomainPackVersionTest {

  @Test
  @DisplayName("activate: PUBLISHED 아닌 상태에서 호출 시 lifecycleStatus가 PUBLISHED로 변경된다")
  void activate_fromNonPublished_setsPublished() {
    DomainPackVersion version = createDraftVersion();
    OffsetDateTime now = OffsetDateTime.parse("2026-04-09T12:00:00Z");

    version.activate(now);

    assertThat(version.getLifecycleStatus()).isEqualTo("PUBLISHED");
    assertThat(version.getPublishedAt()).isEqualTo(now);
    // updatedAt은 @PreUpdate(JPA 저장 시점)에서 갱신되므로 도메인 단위 테스트에서는 검증하지 않는다
  }

  @Test
  @DisplayName("activate: 이미 PUBLISHED 상태에서 호출 시 IllegalStateException 발생")
  void activate_fromPublished_throwsException() {
    DomainPackVersion version = createPublishedVersion();

    assertThatThrownBy(() -> version.activate(OffsetDateTime.now()))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("already published");
  }

  // ── factories ──────────────────────────────────────────────────────────────

  private DomainPackVersion createDraftVersion() {
    DomainPackVersion version = new DomainPackVersion();
    ReflectionTestUtils.setField(version, "lifecycleStatus", "DRAFT");
    ReflectionTestUtils.setField(version, "updatedAt", OffsetDateTime.now());
    return version;
  }

  private DomainPackVersion createPublishedVersion() {
    DomainPackVersion version = new DomainPackVersion();
    ReflectionTestUtils.setField(version, "lifecycleStatus", "PUBLISHED");
    ReflectionTestUtils.setField(version, "updatedAt", OffsetDateTime.now());
    return version;
  }
}
