package com.init.shared.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import liquibase.integration.spring.SpringLiquibase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@DisplayName("Liquibase pgvector migration")
class LiquibasePgvectorMigrationTest {

  @Container
  static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("pgvector/pgvector:pg16");

  static {
    postgres.start();
  }

  @Test
  @DisplayName("pgvector extension이 준비된 PostgreSQL에 master changelog를 적용할 수 있다")
  void should_applyMasterChangelog_when_pgvectorExtensionExists() throws Exception {
    DriverManagerDataSource dataSource = new DriverManagerDataSource();
    dataSource.setUrl(postgres.getJdbcUrl());
    dataSource.setUsername(postgres.getUsername());
    dataSource.setPassword(postgres.getPassword());
    JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
    jdbcTemplate.execute("CREATE EXTENSION IF NOT EXISTS vector");

    SpringLiquibase liquibase = new SpringLiquibase();
    liquibase.setDataSource(dataSource);
    liquibase.setChangeLog("classpath:db/changelog/db.changelog-master.sql");
    liquibase.afterPropertiesSet();

    Integer count =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema = 'pack'
              AND table_name = 'workflow_matching_profile'
            """,
            Integer.class);

    assertThat(count).isEqualTo(1);
  }
}
