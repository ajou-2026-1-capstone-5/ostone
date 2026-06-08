package com.init.domainpack.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.IntentSlotBindingRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionSummaryRow;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSessionRepository;
import jakarta.persistence.EntityManager;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.ActiveProfiles;

@DisplayName("DemoRefundRequestSeedRunner profile")
@SpringBootTest(
    classes = {
      DemoRefundRequestSeedRunner.class,
      DemoRefundSeedRunnerIntegrationTest.RunnerDependencies.class
    },
    properties = {
      "spring.datasource.url=jdbc:h2:mem:demo-refund-seed;"
          + "MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.hibernate.ddl-auto=create-drop",
      "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect",
      "spring.jpa.properties.hibernate.hbm2ddl.create_namespaces=true",
      "spring.liquibase.enabled=false"
    })
@ActiveProfiles("test")
class DemoRefundSeedRunnerIntegrationTest {

  @Autowired private DemoRefundRequestSeedRunner runner;

  @Test
  @DisplayName("bean이 로드된다")
  void shouldLoadRunnerBean() {
    assertThat(runner).isNotNull();
  }

  @TestConfiguration
  static class RunnerDependencies {

    @Bean
    WorkflowDefinitionRepository workflowDefinitionRepository() {
      // Auto-run triggered by @SpringBootTest calls seedIfMissing().
      // Returning an existing workflow causes seedIfMissing to short-circuit
      // so the test verifies bean loading without actual persistence.
      WorkflowDefinitionRepository repository = mock(WorkflowDefinitionRepository.class);
      given(repository.findAllByDomainPackVersionIdOrderByWorkflowCodeAsc(101L))
          .willReturn(List.of(existingWorkflow()));
      return repository;
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

    private WorkflowDefinitionSummaryRow existingWorkflow() {
      return new WorkflowDefinitionSummaryRow() {
        @Override
        public Long getId() {
          return 153L;
        }

        @Override
        public Long getDomainPackVersionId() {
          return 101L;
        }

        @Override
        public Long getIntentDefinitionId() {
          return 100L;
        }

        @Override
        public String getWorkflowCode() {
          return "refund_request_flow";
        }

        @Override
        public String getName() {
          return "환불 요청 처리";
        }

        @Override
        public String getDescription() {
          return "환불 요청 워크플로우";
        }

        @Override
        public String getInitialState() {
          return "start";
        }

        @Override
        public String getTerminalStatesJson() {
          return "[]";
        }

        @Override
        public OffsetDateTime getCreatedAt() {
          return null;
        }

        @Override
        public OffsetDateTime getUpdatedAt() {
          return null;
        }
      };
    }
  }
}
