package com.init.domainpack.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.IntentSlotBindingRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSessionRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;

@DisplayName("DemoRefundRequestSeedRunner profile")
class DemoRefundSeedRunnerIntegrationTest {

  private final ApplicationContextRunner contextRunner =
      new ApplicationContextRunner()
          .withUserConfiguration(DemoRefundRequestSeedRunner.class, RunnerDependencies.class);

  @Test
  @DisplayName("prod profile이 활성화되면 bean이 로드된다")
  void shouldLoadRunnerBeanWhenProdProfileActive() {
    contextRunner
        .withPropertyValues("spring.profiles.active=prod")
        .run(context -> assertThat(context).hasSingleBean(DemoRefundRequestSeedRunner.class));
  }

  @Test
  @DisplayName("prod profile이 아니면 bean이 생성되지 않는다")
  void shouldNotLoadRunnerBeanWhenProdProfileInactive() {
    contextRunner.run(
        context -> assertThat(context).doesNotHaveBean(DemoRefundRequestSeedRunner.class));
  }

  @TestConfiguration
  static class RunnerDependencies {

    @Bean
    WorkflowDefinitionRepository workflowDefinitionRepository() {
      return mock(WorkflowDefinitionRepository.class);
    }

    @Bean
    IntentDefinitionRepository intentDefinitionRepository() {
      return mock(IntentDefinitionRepository.class);
    }

    @Bean
    IntentSlotBindingRepository intentSlotBindingRepository() {
      return mock(IntentSlotBindingRepository.class);
    }

    @Bean
    ChatSessionRepository chatSessionRepository() {
      return mock(ChatSessionRepository.class);
    }

    @Bean
    ChatMessageRepository chatMessageRepository() {
      return mock(ChatMessageRepository.class);
    }

    @Bean
    EntityManager entityManager() {
      return mock(EntityManager.class);
    }
  }
}
