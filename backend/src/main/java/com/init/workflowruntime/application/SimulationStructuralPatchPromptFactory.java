package com.init.workflowruntime.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.workflowruntime.application.dto.SimulationImprovementEvidence;
import com.init.workflowruntime.domain.StructuralDomainPackPatch;
import org.springframework.stereotype.Component;

/**
 * 구조적 패치 생성용 system/user 프롬프트를 만든다. evidence는 백엔드가 조립한 사실만 담아 직렬화하고, 모델에는 #879 허용 operation과 출력 계약,
 * 최소 변경/기존 식별자 보존 규칙을 강제한다.
 */
@Component
public class SimulationStructuralPatchPromptFactory {

  static final String NEEDS_HUMAN_TARGET = "NEEDS_HUMAN_TARGET";

  private static final String SYSTEM_PROMPT =
      """
      You are a Domain Pack repair planner for a customer-service workflow system.
      You convert simulation feedback and golden-replay failures into a structured,
      reviewable repair patch. You never apply changes; you only emit one JSON document.
      Return JSON only, with no prose and no code fences.
      """;

  private static final String INSTRUCTIONS =
      """
      You are given an evidence package describing a simulation failure and the current Domain Pack.
      Produce ONE JSON document that repairs the smallest number of Domain Pack elements needed.

      Rules:
      - Repair the smallest number of elements that satisfy the evidence.
      - Prefer changing an existing workflow over creating a new workflow.
      - When the failure is a missing slot question, prefer adding/marking required slots over adding vague response text.
      - Preserve existing node ids, slot codes, policy codes, risk codes, and workflow codes whenever possible.
      - Do not invent external facts. Use only codes/ids present in the evidence.
      - Every operation must include a "reason".

      Output schema (schemaVersion MUST be "%s"):
      {
        "schemaVersion": "%s",
        "summary": "<one Korean sentence>",
        "evidence": { "feedbackId": <num>, "simulationSessionId": <num>, "failureSummary": "<text>" },
        "operations": [ { "op": "...", "reason": "...", ... } ]
      }

      Allowed operations and their fields:
      - UPDATE_INTENT_DESCRIPTION: intentCode|targetId, description
      - ADD_INTENT_EXAMPLE: intentCode|targetId, example
      - UPDATE_SLOT_DESCRIPTION: slotCode|targetId, description
      - MARK_SLOT_REQUIRED: slotCode|targetId
      - UPDATE_SLOT_VALIDATION: slotCode|targetId, validation
      - UPDATE_POLICY_CONDITION: policyCode|targetId, condition
      - UPDATE_RISK_TRIGGER: riskCode|targetId, trigger
      - UPDATE_RESPONSE_COPY: responseCode|targetId, copy
      - ADD_WORKFLOW_NODE: workflowCode|workflowDefinitionId, nodeId, nodeType, (slotCode, prompt)
      - UPDATE_WORKFLOW_NODE: workflowCode|workflowDefinitionId, nodeId, nodeType, (slotCode, prompt)
      - ADD_TRANSITION: workflowCode|workflowDefinitionId, from, to, (condition)
      - UPDATE_TRANSITION: workflowCode|workflowDefinitionId, from, to, (condition)
      - REMOVE_TRANSITION: workflowCode|workflowDefinitionId, from, to

      If you cannot safely identify which Domain Pack element to change, do NOT guess.
      Instead return exactly: {"status":"%s","summary":"<why a human must choose the target>"}

      Evidence package:
      %s
      """;

  private final ObjectMapper objectMapper;

  public SimulationStructuralPatchPromptFactory(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  public String systemPrompt() {
    return SYSTEM_PROMPT;
  }

  public String buildUserPrompt(SimulationImprovementEvidence evidence) {
    return INSTRUCTIONS.formatted(
        StructuralDomainPackPatch.SCHEMA_VERSION,
        StructuralDomainPackPatch.SCHEMA_VERSION,
        NEEDS_HUMAN_TARGET,
        serialize(evidence));
  }

  private String serialize(SimulationImprovementEvidence evidence) {
    try {
      return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(evidence);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException("evidence 직렬화에 실패했습니다.", e);
    }
  }
}
