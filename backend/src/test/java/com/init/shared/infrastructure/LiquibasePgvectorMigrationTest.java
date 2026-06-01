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
  @DisplayName("운영 app_user 권한으로 master changelog가 앱 스키마를 생성할 수 있다")
  void should_applyMasterChangelogAndCreateApplicationSchemas_when_appUserHasCreatePrivilege()
      throws Exception {
    DriverManagerDataSource adminDataSource = new DriverManagerDataSource();
    adminDataSource.setUrl(postgres.getJdbcUrl());
    adminDataSource.setUsername(postgres.getUsername());
    adminDataSource.setPassword(postgres.getPassword());
    JdbcTemplate adminJdbcTemplate = new JdbcTemplate(adminDataSource);
    adminJdbcTemplate.execute("CREATE EXTENSION IF NOT EXISTS vector");
    adminJdbcTemplate.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
            CREATE ROLE app_user LOGIN PASSWORD 'app-password';
          END IF;
        END
        $$;
        """);
    String databaseName = postgres.getDatabaseName();
    adminJdbcTemplate.execute("GRANT CONNECT ON DATABASE " + databaseName + " TO app_user");
    adminJdbcTemplate.execute("GRANT CREATE ON DATABASE " + databaseName + " TO app_user");
    adminJdbcTemplate.execute("GRANT USAGE, CREATE ON SCHEMA public TO app_user");
    adminJdbcTemplate.execute(
        "ALTER ROLE app_user SET search_path TO app, corpus, pack, review, pipeline, runtime, public");

    DriverManagerDataSource dataSource = new DriverManagerDataSource();
    dataSource.setUrl(postgres.getJdbcUrl());
    dataSource.setUsername("app_user");
    dataSource.setPassword("app-password");
    JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);

    SpringLiquibase liquibase = new SpringLiquibase();
    liquibase.setDataSource(dataSource);
    liquibase.setChangeLog("classpath:db/changelog/db.changelog-master.sql");
    liquibase.afterPropertiesSet();

    Integer changelogCount =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'databasechangelog'
            """,
            Integer.class);
    Integer count =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema = 'pack'
              AND table_name = 'workflow_matching_profile'
            """,
            Integer.class);

    assertThat(changelogCount).isEqualTo(1);
    assertThat(count).isEqualTo(1);
  }
}
