package com.init.domainpack.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.infrastructure.persistence.JpaWorkflowDefinitionRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.jdbc.Sql;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Sql(
    scripts = "classpath:policyref-workflow-table.sql",
    executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
@DisplayName("JpaWorkflowDefinitionRepository — JSONB policyRef (PostgreSQL)")
class JpaWorkflowDefinitionRepositoryPolicyRefTest {

  @Container
  static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

  static {
    // Start the container eagerly in the class initializer so it is ready before
    // SpringExtension evaluates @DynamicPropertySource. Without this, extension
    // registration order (@DataJpaTest above @Testcontainers) lets Spring load the
    // context first and call postgres::getJdbcUrl before TestcontainersExtension
    // starts the container, which fails with IllegalStateException on slower CI runners.
    postgres.start();
  }

  @DynamicPropertySource
  static void configureDataSource(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
    registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "none");
    registry.add(
        "spring.jpa.properties.hibernate.dialect", () -> "org.hibernate.dialect.PostgreSQLDialect");
    registry.add("spring.liquibase.enabled", () -> "false");
    // Defensive dual schema-creation: Hikari's connection-init-sql runs per connection before
    // Hibernate creates namespaces, so both settings ensure the 'pack' schema exists and is on
    // the search_path regardless of initialization order.
    registry.add("spring.jpa.properties.hibernate.hbm2ddl.create_namespaces", () -> "true");
    registry.add(
        "spring.datasource.hikari.connection-init-sql", () -> "SET search_path TO pack, public");
  }

  @Autowired private JpaWorkflowDefinitionRepository repository;

  @Autowired private TestEntityManager em;

  @Test
  @DisplayName("policyRef 없는 노드만 있는 graphJson → false")
  void should_false_when_policyRef없는노드만존재() {
    String graphJson = "{\"nodes\":[{\"id\":\"n1\",\"type\":\"ACTION\"}]}";
    em.persistAndFlush(workflow(1L, "refund_flow", graphJson));

    boolean result = repository.existsByDomainPackVersionIdAndPolicyRef(1L, "refund_check");

    assertThat(result).isFalse();
  }

  @Test
  @DisplayName("policyRef 포함 노드 있는 graphJson → true")
  void should_true_when_policyRef포함노드존재() {
    String graphJson =
        "{\"nodes\":[{\"id\":\"n1\",\"type\":\"ACTION\",\"policyRef\":\"refund_check\"}]}";
    em.persistAndFlush(workflow(2L, "refund_flow", graphJson));

    boolean result = repository.existsByDomainPackVersionIdAndPolicyRef(2L, "refund_check");

    assertThat(result).isTrue();
  }

  @Test
  @DisplayName("nodes 배열이 없는 graphJson → false")
  void should_false_when_nodes없는graphJson() {
    String graphJson = "{\"direction\":\"LR\"}";
    em.persistAndFlush(workflow(3L, "empty_flow", graphJson));

    boolean result = repository.existsByDomainPackVersionIdAndPolicyRef(3L, "refund_check");

    assertThat(result).isFalse();
  }

  private WorkflowDefinition workflow(Long versionId, String code, String graphJson) {
    return WorkflowDefinition.create(
        versionId, code, code + "_name", null, graphJson, "start", "[\"done\"]", "[]", "{}");
  }
}
