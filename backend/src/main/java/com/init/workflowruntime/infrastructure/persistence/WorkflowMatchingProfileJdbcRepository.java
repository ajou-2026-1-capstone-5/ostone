package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.application.matching.WorkflowMatchingProfileCandidate;
import com.init.workflowruntime.application.matching.WorkflowMatchingProfileWrite;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class WorkflowMatchingProfileJdbcRepository {

  private final JdbcTemplate jdbcTemplate;

  public WorkflowMatchingProfileJdbcRepository(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  public int countActiveProfiles(Long domainPackVersionId) {
    Integer count =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM pack.workflow_matching_profile
            WHERE domain_pack_version_id = ?
              AND profile_status = 'ACTIVE'
            """,
            Integer.class,
            domainPackVersionId);
    return count == null ? 0 : count;
  }

  public void deleteBuildingProfiles(Long domainPackVersionId, String profileVersion) {
    jdbcTemplate.update(
        """
        DELETE FROM pack.workflow_matching_profile
        WHERE domain_pack_version_id = ?
          AND profile_version = ?
          AND profile_status = 'BUILDING'
        """,
        domainPackVersionId,
        profileVersion);
  }

  public void insertBuildingProfile(
      Long domainPackVersionId,
      Long workflowDefinitionId,
      Long intentDefinitionId,
      String profileVersion,
      String profileTextHash,
      String profileText,
      String embeddingLiteral,
      String embeddingProvider,
      String embeddingModel,
      String embeddingRegion,
      String embeddingInputType,
      String qualityJson,
      String sourceJson) {
    jdbcTemplate.update(
        """
        INSERT INTO pack.workflow_matching_profile (
            domain_pack_version_id,
            workflow_definition_id,
            intent_definition_id,
            profile_version,
            profile_text_hash,
            profile_text,
            embedding,
            embedding_provider,
            embedding_model,
            embedding_region,
            embedding_input_type,
            quality_json,
            source_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?::vector, ?, ?, ?, ?, ?::jsonb, ?::jsonb)
        """,
        domainPackVersionId,
        workflowDefinitionId,
        intentDefinitionId,
        profileVersion,
        profileTextHash,
        profileText,
        embeddingLiteral,
        embeddingProvider,
        embeddingModel,
        embeddingRegion,
        embeddingInputType,
        qualityJson,
        sourceJson);
  }

  @Transactional
  public void replaceActiveProfileVersionAndMarkSucceeded(
      Long jobId,
      Long domainPackVersionId,
      String profileVersion,
      List<WorkflowMatchingProfileWrite> profiles) {
    deleteBuildingProfiles(domainPackVersionId, profileVersion);
    for (WorkflowMatchingProfileWrite profile : profiles) {
      insertBuildingProfile(
          profile.domainPackVersionId(),
          profile.workflowDefinitionId(),
          profile.intentDefinitionId(),
          profile.profileVersion(),
          profile.profileTextHash(),
          profile.profileText(),
          profile.embeddingLiteral(),
          profile.embeddingProvider(),
          profile.embeddingModel(),
          profile.embeddingRegion(),
          profile.embeddingInputType(),
          profile.qualityJson(),
          profile.sourceJson());
    }
    jdbcTemplate.update(
        """
        UPDATE pack.workflow_matching_profile
        SET profile_status = 'STALE',
            updated_at = NOW()
        WHERE domain_pack_version_id = ?
          AND profile_status = 'ACTIVE'
        """,
        domainPackVersionId);
    jdbcTemplate.update(
        """
        UPDATE pack.workflow_matching_profile
        SET profile_status = 'ACTIVE',
            updated_at = NOW()
        WHERE domain_pack_version_id = ?
          AND profile_version = ?
          AND profile_status = 'BUILDING'
        """,
        domainPackVersionId,
        profileVersion);
    jdbcTemplate.update(
        """
        UPDATE pack.workflow_matching_profile_build
        SET status = 'SUCCEEDED',
            finished_at = NOW(),
            updated_at = NOW(),
            error_json = '{}'::jsonb
        WHERE id = ?
        """,
        jobId);
  }

  public List<WorkflowMatchingProfileCandidate> findNearestActive(
      Long domainPackVersionId, String embeddingLiteral, String lexicalQuery, int limit) {
    return jdbcTemplate.query(
        """
        WITH query AS (
            SELECT ?::vector AS embedding,
                   websearch_to_tsquery('simple', ?) AS lexical_query
        ),
        vector_candidates AS (
            SELECT p.id
            FROM pack.workflow_matching_profile p
            JOIN pack.intent_definition i ON i.id = p.intent_definition_id
            CROSS JOIN query
            WHERE p.domain_pack_version_id = ?
              AND p.profile_status = 'ACTIVE'
              AND i.status = 'PUBLISHED'
            ORDER BY p.embedding <=> query.embedding
            LIMIT ?
        ),
        lexical_candidates AS (
            SELECT p.id
            FROM pack.workflow_matching_profile p
            JOIN pack.intent_definition i ON i.id = p.intent_definition_id
            CROSS JOIN query
            WHERE p.domain_pack_version_id = ?
              AND p.profile_status = 'ACTIVE'
              AND i.status = 'PUBLISHED'
              AND numnode(query.lexical_query) > 0
              AND p.profile_search_vector @@ query.lexical_query
            ORDER BY ts_rank_cd(p.profile_search_vector, query.lexical_query) DESC
            LIMIT ?
        ),
        candidate_ids AS (
            SELECT id FROM vector_candidates
            UNION
            SELECT id FROM lexical_candidates
        ),
        operational_prior AS (
            SELECT d.selected_workflow_id AS workflow_definition_id,
                   CASE
                       WHEN COUNT(e.id) = 0 THEN 0.50
                       ELSE ((COUNT(*) FILTER (WHERE e.status = 'COMPLETED'))::double precision + 1.0)
                            / ((COUNT(*) FILTER (WHERE e.status IN ('COMPLETED', 'FAILED')))::double precision + 2.0)
                   END AS operational_prior_score
            FROM candidate_ids c
            JOIN pack.workflow_matching_profile candidate_profile ON candidate_profile.id = c.id
            JOIN runtime.workflow_match_decision d
              ON d.selected_workflow_id = candidate_profile.workflow_definition_id
            LEFT JOIN runtime.workflow_execution e ON e.id = d.workflow_execution_id
            WHERE d.domain_pack_version_id = ?
              AND d.status = 'CONFIDENT'
              AND d.created_at >= NOW() - INTERVAL '90 days'
            GROUP BY d.selected_workflow_id
        )
        SELECT p.id AS profile_id,
               p.workflow_definition_id,
               p.intent_definition_id,
               w.workflow_code,
               w.name AS workflow_name,
               i.intent_code,
               i.name AS intent_name,
               i.entry_condition_json::text AS intent_entry_condition_json,
               p.profile_version,
               p.profile_text,
               w.route_condition_json::text AS route_condition_json,
               w.meta_json::text AS workflow_meta_json,
               p.quality_json::text AS quality_json,
               p.source_json::text AS source_json,
               p.embedding_provider,
               p.embedding_model,
               p.embedding_region,
               1 - (p.embedding <=> query.embedding) AS semantic_score,
               CASE
                   WHEN numnode(query.lexical_query) = 0 THEN 0.0
                   ELSE ts_rank_cd(p.profile_search_vector, query.lexical_query)
               END AS lexical_search_score,
               COALESCE(prior.operational_prior_score, 0.50) AS operational_prior_score
        FROM candidate_ids c
        JOIN pack.workflow_matching_profile p ON p.id = c.id
        JOIN pack.workflow_definition w ON w.id = p.workflow_definition_id
        JOIN pack.intent_definition i ON i.id = p.intent_definition_id
        CROSS JOIN query
        LEFT JOIN operational_prior prior ON prior.workflow_definition_id = p.workflow_definition_id
        ORDER BY GREATEST(
                    1 - (p.embedding <=> query.embedding),
                    CASE
                        WHEN numnode(query.lexical_query) = 0 THEN 0.0
                        ELSE ts_rank_cd(p.profile_search_vector, query.lexical_query)
                    END
                 ) DESC,
                 p.embedding <=> query.embedding
        LIMIT (? * 2)
        """,
        (rs, rowNum) -> mapCandidate(rs),
        embeddingLiteral,
        lexicalQuery,
        domainPackVersionId,
        limit,
        domainPackVersionId,
        limit,
        domainPackVersionId,
        limit);
  }

  private WorkflowMatchingProfileCandidate mapCandidate(ResultSet rs) throws SQLException {
    return new WorkflowMatchingProfileCandidate(
        rs.getLong("profile_id"),
        rs.getLong("workflow_definition_id"),
        rs.getLong("intent_definition_id"),
        rs.getString("workflow_code"),
        rs.getString("workflow_name"),
        rs.getString("intent_code"),
        rs.getString("intent_name"),
        rs.getString("intent_entry_condition_json"),
        rs.getString("profile_version"),
        rs.getString("profile_text"),
        rs.getString("route_condition_json"),
        rs.getString("workflow_meta_json"),
        rs.getString("quality_json"),
        rs.getString("source_json"),
        rs.getString("embedding_provider"),
        rs.getString("embedding_model"),
        rs.getString("embedding_region"),
        rs.getDouble("semantic_score"),
        rs.getDouble("lexical_search_score"),
        rs.getDouble("operational_prior_score"));
  }
}
