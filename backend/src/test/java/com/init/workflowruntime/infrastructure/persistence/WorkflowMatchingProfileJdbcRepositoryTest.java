package com.init.workflowruntime.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.init.workflowruntime.application.matching.EmbeddingProperties;
import com.init.workflowruntime.application.matching.VectorUtils;
import com.init.workflowruntime.application.matching.WorkflowMatchingProfileBuildJob;
import com.init.workflowruntime.application.matching.WorkflowMatchingProfileCandidate;
import com.init.workflowruntime.application.matching.WorkflowMatchingProfileWrite;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@DisplayName("WorkflowMatchingProfileJdbcRepository")
class WorkflowMatchingProfileJdbcRepositoryTest {

  @Container
  static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("pgvector/pgvector:pg16");

  static {
    postgres.start();
  }

  private JdbcTemplate jdbcTemplate;
  private WorkflowMatchingProfileJdbcRepository repository;
  private WorkflowMatchingProfileBuildJdbcRepository buildRepository;

  @BeforeEach
  void setUp() {
    DriverManagerDataSource dataSource = new DriverManagerDataSource();
    dataSource.setUrl(postgres.getJdbcUrl());
    dataSource.setUsername(postgres.getUsername());
    dataSource.setPassword(postgres.getPassword());
    jdbcTemplate = new JdbcTemplate(dataSource);
    repository = new WorkflowMatchingProfileJdbcRepository(jdbcTemplate);
    buildRepository =
        new WorkflowMatchingProfileBuildJdbcRepository(jdbcTemplate, embeddingProperties());
    recreateSchema();
  }

  @Test
  @DisplayName("active profile만 pgvector top-K 검색 대상이 된다")
  void should_findNearestActivePublishedProfile() {
    insertIntent(10L, "refund_request", "환불 요청", "PUBLISHED");
    insertIntent(11L, "legacy_refund", "레거시 환불", "REJECTED");
    insertWorkflow(20L, 101L, "refund_flow", "환불 접수", 10L);
    insertWorkflow(21L, 101L, "legacy_refund_flow", "레거시 환불", 11L);
    insertProfile(101L, 20L, 10L, "ACTIVE", vector(1.0f, 0.0f));
    insertProfile(101L, 21L, 11L, "ACTIVE", vector(1.0f, 0.0f));
    insertProfile(101L, 20L, 10L, "STALE", vector(0.0f, 1.0f));

    List<WorkflowMatchingProfileCandidate> candidates =
        repository.findNearestActive(
            101L, VectorUtils.toVectorLiteral(vector(1.0f, 0.0f)), "\"환불\"", 10);

    assertThat(repository.countActiveProfiles(101L)).isEqualTo(2);
    assertThat(candidates).hasSize(1);
    assertThat(candidates.getFirst().intentCode()).isEqualTo("refund_request");
    assertThat(candidates.getFirst().workflowCode()).isEqualTo("refund_flow");
    assertThat(candidates.getFirst().lexicalSearchScore()).isGreaterThan(0.0);
    assertThat(candidates.getFirst().operationalPriorScore()).isEqualTo(0.50);
  }

  @Test
  @DisplayName("vector top-K 밖 후보도 lexical 검색에 걸리면 hybrid 후보에 포함된다")
  void should_includeLexicalCandidateOutsideVectorTopK() {
    insertIntent(10L, "refund_request", "환불 요청", "PUBLISHED");
    insertIntent(11L, "address_change", "배송지 변경", "PUBLISHED");
    insertWorkflow(20L, 101L, "refund_flow", "환불 접수", 10L);
    insertWorkflow(21L, 101L, "address_flow", "배송지 변경", 11L);
    insertProfile(101L, 20L, 10L, "ACTIVE", "환불 접수 lexical_terms: 환불", vector(0.0f, 1.0f));
    insertProfile(101L, 21L, 11L, "ACTIVE", "배송지 변경 lexical_terms: 배송지", vector(1.0f, 0.0f));

    List<WorkflowMatchingProfileCandidate> candidates =
        repository.findNearestActive(
            101L, VectorUtils.toVectorLiteral(vector(1.0f, 0.0f)), "\"환불\"", 1);

    assertThat(candidates)
        .extracting(WorkflowMatchingProfileCandidate::workflowCode)
        .contains("refund_flow");
  }

  @Test
  @DisplayName("매칭 검색과 operational prior 인덱스를 생성할 수 있다")
  void should_createMatchingIndexes() {
    Integer hnswCount =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM pg_indexes
            WHERE schemaname = 'pack'
              AND indexname = 'idx_workflow_matching_profile_embedding_hnsw'
            """,
            Integer.class);
    Integer ginCount =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM pg_indexes
            WHERE schemaname = 'pack'
              AND indexname = 'idx_workflow_matching_profile_search_vector_gin'
            """,
            Integer.class);
    Integer domainStatusCount =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM pg_indexes
            WHERE schemaname = 'pack'
              AND indexname = 'idx_workflow_matching_profile_domain_status'
            """,
            Integer.class);
    Integer decisionPriorCount =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM pg_indexes
            WHERE schemaname = 'runtime'
              AND indexname = 'idx_workflow_match_decision_recent_confident_workflow'
            """,
            Integer.class);

    assertThat(hnswCount).isEqualTo(1);
    assertThat(ginCount).isEqualTo(1);
    assertThat(domainStatusCount).isEqualTo(1);
    assertThat(decisionPriorCount).isEqualTo(1);
  }

  @Test
  @DisplayName("최근 workflow 실행 결과를 operational prior로 후보에 함께 반환한다")
  void should_returnOperationalPriorFromRecentExecutionOutcomes() {
    insertIntent(10L, "refund_request", "환불 요청", "PUBLISHED");
    insertWorkflow(20L, 101L, "refund_flow", "환불 접수", 10L);
    insertProfile(101L, 20L, 10L, "ACTIVE", vector(1.0f, 0.0f));
    insertExecutionDecision(1L, 101L, 20L, "COMPLETED");
    insertExecutionDecision(2L, 101L, 20L, "FAILED");
    insertExecutionDecision(3L, 101L, 20L, "COMPLETED");

    List<WorkflowMatchingProfileCandidate> candidates =
        repository.findNearestActive(
            101L, VectorUtils.toVectorLiteral(vector(1.0f, 0.0f)), "\"환불\"", 10);

    assertThat(candidates.getFirst().operationalPriorScore()).isEqualTo(0.60);
  }

  @Test
  @DisplayName("stale RUNNING build job은 재시도 대상으로 다시 claim된다")
  void should_reclaimStaleRunningBuildJob() {
    insertBuildJob(1L, 101L, "v101-stale", "RUNNING", 1, "20 minutes");

    Optional<WorkflowMatchingProfileBuildJob> claimed = buildRepository.claimNext();

    assertThat(claimed).isPresent();
    assertThat(claimed.get().id()).isEqualTo(1L);
    assertThat(jobStatus(1L)).isEqualTo("RUNNING");
    assertThat(jobRetryCount(1L)).isEqualTo(2);
  }

  @Test
  @DisplayName("retry 한도가 찬 stale RUNNING build job은 FAILED로 닫는다")
  void should_failExhaustedStaleRunningBuildJob() {
    insertBuildJob(1L, 101L, "v101-exhausted", "RUNNING", 3, "20 minutes");

    Optional<WorkflowMatchingProfileBuildJob> claimed = buildRepository.claimNext();

    assertThat(claimed).isEmpty();
    assertThat(jobStatus(1L)).isEqualTo("FAILED");
    assertThat(jobErrorJson(1L)).contains("ProfileBuildTimeout");
  }

  @Test
  @DisplayName("새 profile version 교체와 build 성공 처리는 하나의 트랜잭션으로 끝난다")
  void should_replaceActiveProfilesAndMarkBuildSucceeded() {
    insertIntent(10L, "refund_request", "환불 요청", "PUBLISHED");
    insertWorkflow(20L, 101L, "refund_flow", "환불 접수", 10L);
    insertBuildJob(1L, 101L, "profile-v2", "RUNNING", 1, "1 minute");
    insertProfile(101L, 20L, 10L, "ACTIVE", vector(0.0f, 1.0f));

    repository.replaceActiveProfileVersionAndMarkSucceeded(
        1L,
        101L,
        "profile-v2",
        List.of(
            new WorkflowMatchingProfileWrite(
                101L,
                20L,
                10L,
                "profile-v2",
                "new-hash",
                "환불 요청",
                VectorUtils.toVectorLiteral(vector(1.0f, 0.0f)),
                "bedrock",
                "cohere.embed-v4:0",
                "ap-northeast-2",
                "search_document",
                "{}",
                "{}")));

    assertThat(activeProfileCount(101L)).isEqualTo(1);
    assertThat(staleProfileCount(101L)).isEqualTo(1);
    assertThat(jobStatus(1L)).isEqualTo("SUCCEEDED");
  }

  private void recreateSchema() {
    jdbcTemplate.execute("DROP SCHEMA IF EXISTS pack CASCADE");
    jdbcTemplate.execute("DROP SCHEMA IF EXISTS runtime CASCADE");
    jdbcTemplate.execute("CREATE EXTENSION IF NOT EXISTS vector");
    jdbcTemplate.execute("CREATE SCHEMA pack");
    jdbcTemplate.execute("CREATE SCHEMA runtime");
    jdbcTemplate.execute(
        """
        CREATE TABLE pack.intent_definition (
            id BIGINT PRIMARY KEY,
            intent_code VARCHAR(100) NOT NULL,
            name VARCHAR(255) NOT NULL,
            entry_condition_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            status VARCHAR(50) NOT NULL
        )
        """);
    jdbcTemplate.execute(
        """
        CREATE TABLE pack.workflow_definition (
            id BIGINT PRIMARY KEY,
            domain_pack_version_id BIGINT NOT NULL,
            workflow_code VARCHAR(100) NOT NULL,
            name VARCHAR(255) NOT NULL,
            route_condition_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            meta_json JSONB NOT NULL DEFAULT '{}'::jsonb
        )
        """);
    jdbcTemplate.execute(
        """
        CREATE TABLE pack.workflow_matching_profile_build (
            id BIGINT PRIMARY KEY,
            domain_pack_version_id BIGINT NOT NULL,
            trigger_type VARCHAR(100) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
            profile_version VARCHAR(100) NOT NULL,
            retry_count INTEGER NOT NULL DEFAULT 0,
            max_retries INTEGER NOT NULL DEFAULT 3,
            error_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            started_at TIMESTAMPTZ,
            finished_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """);
    jdbcTemplate.execute(
        """
        CREATE TABLE pack.workflow_matching_profile (
            id BIGSERIAL PRIMARY KEY,
            domain_pack_version_id BIGINT NOT NULL,
            workflow_definition_id BIGINT NOT NULL,
            intent_definition_id BIGINT NOT NULL,
            profile_kind VARCHAR(50) NOT NULL DEFAULT 'WORKFLOW_ENTRYPOINT',
            profile_status VARCHAR(50) NOT NULL DEFAULT 'BUILDING',
            profile_version VARCHAR(100) NOT NULL,
            profile_text_hash VARCHAR(64) NOT NULL DEFAULT 'profile-hash',
            profile_text TEXT NOT NULL,
            quality_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            source_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            embedding_provider VARCHAR(50) NOT NULL,
            embedding_model VARCHAR(100) NOT NULL,
            embedding_region VARCHAR(50) NOT NULL,
            embedding_input_type VARCHAR(50) NOT NULL DEFAULT 'search_document',
            embedding vector(1024) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            profile_search_vector tsvector GENERATED ALWAYS AS
                (to_tsvector('simple', COALESCE(profile_text, ''))) STORED
        )
        """);
    jdbcTemplate.execute(
        """
        CREATE INDEX idx_workflow_matching_profile_embedding_hnsw
            ON pack.workflow_matching_profile USING hnsw (embedding vector_cosine_ops)
        """);
    jdbcTemplate.execute(
        """
        CREATE INDEX idx_workflow_matching_profile_domain_status
            ON pack.workflow_matching_profile (domain_pack_version_id, profile_status)
        """);
    jdbcTemplate.execute(
        """
        CREATE INDEX idx_workflow_matching_profile_search_vector_gin
            ON pack.workflow_matching_profile USING gin (profile_search_vector)
        """);
    jdbcTemplate.execute(
        """
        CREATE TABLE runtime.workflow_execution (
            id BIGINT PRIMARY KEY,
            status VARCHAR(50) NOT NULL
        )
        """);
    jdbcTemplate.execute(
        """
        CREATE TABLE runtime.workflow_match_decision (
            id BIGINT PRIMARY KEY,
            workflow_execution_id BIGINT,
            domain_pack_version_id BIGINT NOT NULL,
            selected_workflow_id BIGINT,
            status VARCHAR(50) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """);
    jdbcTemplate.execute(
        """
        CREATE INDEX idx_workflow_match_decision_recent_confident_workflow
            ON runtime.workflow_match_decision (
                domain_pack_version_id,
                selected_workflow_id,
                created_at DESC
            )
            WHERE status = 'CONFIDENT'
              AND selected_workflow_id IS NOT NULL
        """);
  }

  private void insertIntent(Long id, String intentCode, String name, String status) {
    jdbcTemplate.update(
        """
        INSERT INTO pack.intent_definition (id, intent_code, name, entry_condition_json, status)
        VALUES (?, ?, ?, '{}'::jsonb, ?)
        """,
        id,
        intentCode,
        name,
        status);
  }

  private void insertWorkflow(
      Long id, Long domainPackVersionId, String workflowCode, String name, Long intentId) {
    jdbcTemplate.update(
        """
        INSERT INTO pack.workflow_definition (
            id,
            domain_pack_version_id,
            workflow_code,
            name,
            route_condition_json,
            meta_json
        )
        VALUES (?, ?, ?, ?, '{"requiredTerms":[]}'::jsonb, '{"autoRunEligible":true}'::jsonb)
        """,
        id,
        domainPackVersionId,
        workflowCode,
        name);
  }

  private void insertProfile(
      Long domainPackVersionId,
      Long workflowDefinitionId,
      Long intentDefinitionId,
      String status,
      float[] vector) {
    insertProfile(
        domainPackVersionId, workflowDefinitionId, intentDefinitionId, status, "환불 요청", vector);
  }

  private void insertProfile(
      Long domainPackVersionId,
      Long workflowDefinitionId,
      Long intentDefinitionId,
      String status,
      String profileText,
      float[] vector) {
    jdbcTemplate.update(
        """
        INSERT INTO pack.workflow_matching_profile (
            domain_pack_version_id,
            workflow_definition_id,
            intent_definition_id,
            profile_status,
            profile_version,
            profile_text,
            embedding_provider,
            embedding_model,
            embedding_region,
            embedding
        )
        VALUES (?, ?, ?, ?, 'profile-v1', ?, 'bedrock',
                'cohere.embed-v4:0', 'ap-northeast-2', ?::vector)
        """,
        domainPackVersionId,
        workflowDefinitionId,
        intentDefinitionId,
        status,
        profileText,
        VectorUtils.toVectorLiteral(vector));
  }

  private void insertBuildJob(
      Long id,
      Long domainPackVersionId,
      String profileVersion,
      String status,
      int retryCount,
      String startedAgo) {
    jdbcTemplate.update(
        """
        INSERT INTO pack.workflow_matching_profile_build (
            id,
            domain_pack_version_id,
            trigger_type,
            status,
            profile_version,
            retry_count,
            max_retries,
            started_at,
            created_at
        )
        VALUES (?, ?, 'test', ?, ?, ?, 3, NOW() - (?::interval), NOW() - (?::interval))
        """,
        id,
        domainPackVersionId,
        status,
        profileVersion,
        retryCount,
        startedAgo,
        startedAgo);
  }

  private int activeProfileCount(Long domainPackVersionId) {
    return profileStatusCount(domainPackVersionId, "ACTIVE");
  }

  private int staleProfileCount(Long domainPackVersionId) {
    return profileStatusCount(domainPackVersionId, "STALE");
  }

  private int profileStatusCount(Long domainPackVersionId, String status) {
    Integer count =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM pack.workflow_matching_profile
            WHERE domain_pack_version_id = ?
              AND profile_status = ?
            """,
            Integer.class,
            domainPackVersionId,
            status);
    return count == null ? 0 : count;
  }

  private void insertExecutionDecision(
      Long id, Long domainPackVersionId, Long workflowDefinitionId, String executionStatus) {
    jdbcTemplate.update(
        "INSERT INTO runtime.workflow_execution (id, status) VALUES (?, ?)", id, executionStatus);
    jdbcTemplate.update(
        """
        INSERT INTO runtime.workflow_match_decision (
            id,
            workflow_execution_id,
            domain_pack_version_id,
            selected_workflow_id,
            status
        )
        VALUES (?, ?, ?, ?, 'CONFIDENT')
        """,
        id,
        id,
        domainPackVersionId,
        workflowDefinitionId);
  }

  private String jobStatus(Long id) {
    return jdbcTemplate.queryForObject(
        "SELECT status FROM pack.workflow_matching_profile_build WHERE id = ?", String.class, id);
  }

  private int jobRetryCount(Long id) {
    Integer retryCount =
        jdbcTemplate.queryForObject(
            "SELECT retry_count FROM pack.workflow_matching_profile_build WHERE id = ?",
            Integer.class,
            id);
    return retryCount == null ? 0 : retryCount;
  }

  private String jobErrorJson(Long id) {
    return jdbcTemplate.queryForObject(
        "SELECT error_json::text FROM pack.workflow_matching_profile_build WHERE id = ?",
        String.class,
        id);
  }

  private EmbeddingProperties embeddingProperties() {
    return new EmbeddingProperties(
        "bedrock",
        true,
        "cohere.embed-v4:0",
        "ap-northeast-2",
        Duration.ofSeconds(5),
        Duration.ofSeconds(30),
        Duration.ofMinutes(15),
        Duration.ofMinutes(5),
        30,
        0.70,
        0.72,
        0.55,
        0.10,
        0.65,
        0.50,
        0.30);
  }

  private float[] vector(float first, float second) {
    float[] vector = new float[VectorUtils.COHERE_EMBEDDING_DIMENSION];
    vector[0] = first;
    vector[1] = second;
    return vector;
  }
}
