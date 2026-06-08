package com.init.domainpack.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.password.PasswordEncoder;

@DisplayName("DemoAccountSeedRunner profile")
class DemoAccountSeedRunnerIntegrationTest {

  private final ApplicationContextRunner contextRunner =
      new ApplicationContextRunner()
          .withUserConfiguration(DemoAccountSeedRunner.class, RunnerDependencies.class);

  @Test
  @DisplayName("local/dev/prod profile이 활성화되면 bean이 로드된다")
  void shouldLoadRunnerBeanForSeededProfiles() {
    for (String profile : new String[] {"local", "dev", "prod"}) {
      contextRunner
          .withPropertyValues("spring.profiles.active=" + profile)
          .run(context -> assertThat(context).hasSingleBean(DemoAccountSeedRunner.class));
    }
  }

  @Test
  @DisplayName("test(default) profile에서는 bean이 생성되지 않는다")
  void shouldNotLoadRunnerBeanWhenNoSeedProfileActive() {
    contextRunner.run(context -> assertThat(context).doesNotHaveBean(DemoAccountSeedRunner.class));
  }

  @TestConfiguration
  static class RunnerDependencies {

    @Bean
    EntityManager entityManager() {
      return mock(EntityManager.class);
    }

    @Bean
    PasswordEncoder passwordEncoder() {
      return mock(PasswordEncoder.class);
    }
  }
}
