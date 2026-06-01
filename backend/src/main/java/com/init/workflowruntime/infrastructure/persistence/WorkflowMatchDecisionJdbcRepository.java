package com.init.workflowruntime.infrastructure.persistence;

import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class WorkflowMatchDecisionJdbcRepository {

  private final JdbcTemplate jdbcTemplate;

  public WorkflowMatchDecisionJdbcRepository(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  public void record(
      Long chatSessionId,
      Long domainPackVersionId,
      Long selectedWorkflowId,
      Long selectedIntentId,
      String status,
      double confidenceScore,
      String redactedTextHash,
      String profileVersion,
      String embeddingProvider,
      String embeddingModel,
      String embeddingRegion,
      String thresholdJson,
      String scoreBreakdownJson,
      String topCandidatesJson,
      String failureReason) {
    jdbcTemplate.update(
        """
        INSERT INTO runtime.workflow_match_decision (
            chat_session_id,
            domain_pack_version_id,
            selected_workflow_id,
            selected_intent_id,
            status,
            confidence_score,
            redacted_text_hash,
            profile_version,
            embedding_provider,
            embedding_model,
            embedding_region,
            threshold_json,
            score_breakdown_json,
            top_candidates_json,
            failure_reason
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?)
        """,
        chatSessionId,
        domainPackVersionId,
        selectedWorkflowId,
        selectedIntentId,
        status,
        confidenceScore,
        redactedTextHash,
        profileVersion,
        embeddingProvider,
        embeddingModel,
        embeddingRegion,
        thresholdJson,
        scoreBreakdownJson,
        topCandidatesJson,
        failureReason);
  }

  public Optional<Long> findLatestConfidentWorkflowId(Long chatSessionId, String intentCode) {
    return jdbcTemplate
        .query(
            """
            SELECT d.selected_workflow_id
            FROM runtime.workflow_match_decision d
            JOIN pack.intent_definition i ON i.id = d.selected_intent_id
            WHERE d.chat_session_id = ?
              AND d.status = 'CONFIDENT'
              AND i.intent_code = ?
              AND d.selected_workflow_id IS NOT NULL
            ORDER BY d.created_at DESC
            LIMIT 1
            """,
            (rs, rowNum) -> rs.getLong("selected_workflow_id"),
            chatSessionId,
            intentCode)
        .stream()
        .findFirst();
  }

  public void attachLatestExecution(
      Long chatSessionId, Long workflowDefinitionId, Long workflowExecutionId) {
    jdbcTemplate.update(
        """
        UPDATE runtime.workflow_match_decision
        SET workflow_execution_id = ?
        WHERE id = (
            SELECT id
            FROM runtime.workflow_match_decision
            WHERE chat_session_id = ?
              AND selected_workflow_id = ?
              AND workflow_execution_id IS NULL
            ORDER BY created_at DESC
            LIMIT 1
        )
        """,
        workflowExecutionId,
        chatSessionId,
        workflowDefinitionId);
  }
}
