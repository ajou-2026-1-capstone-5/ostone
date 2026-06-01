package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("AiResponseGenerationGuard")
class AiResponseGenerationGuardTest {

  @Test
  @DisplayName("tryEnter: 동일 세션은 lease 해제 전까지 두 번째 진입을 거절한다")
  void should_rejectSecondEntryUntilLeaseClosed_when_sameSession() {
    AiResponseGenerationGuard guard = new AiResponseGenerationGuard();

    Optional<AiResponseGenerationGuard.Lease> firstLease = guard.tryEnter(1L);
    Optional<AiResponseGenerationGuard.Lease> secondLease = guard.tryEnter(1L);

    assertThat(firstLease).isPresent();
    assertThat(secondLease).isEmpty();

    firstLease.get().close();

    Optional<AiResponseGenerationGuard.Lease> thirdLease = guard.tryEnter(1L);
    assertThat(thirdLease).isPresent();
    thirdLease.get().close();
  }

  @Test
  @DisplayName("tryEnter: 서로 다른 세션은 동시에 진입할 수 있다")
  void should_allowParallelEntry_when_differentSessions() {
    AiResponseGenerationGuard guard = new AiResponseGenerationGuard();

    Optional<AiResponseGenerationGuard.Lease> firstLease = guard.tryEnter(1L);
    Optional<AiResponseGenerationGuard.Lease> secondLease = guard.tryEnter(2L);

    assertThat(firstLease).isPresent();
    assertThat(secondLease).isPresent();

    firstLease.get().close();
    secondLease.get().close();
  }
}
