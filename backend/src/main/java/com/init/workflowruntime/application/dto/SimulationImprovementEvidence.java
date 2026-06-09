package com.init.workflowruntime.application.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;

/**
 * 시뮬레이션 개선 후보를 위해 백엔드가 조립한 근거(evidence) package. LLM이 {@code simulation-structural-patch.v1} 구조적
 * 패치를 생성할 때 입력으로 쓰인다. 어떤 식별자/요소도 LLM이 추측하지 않도록 백엔드가 미리 모은 사실만 담는다.
 */
public record SimulationImprovementEvidence(
    Feedback feedback,
    SessionMeta session,
    GoldenReplay goldenReplay,
    DomainPackContext domainPack) {

  /** 피드백 핵심 필드. */
  public record Feedback(
      Long feedbackId,
      String feedbackType,
      String description,
      String expectedBehavior,
      String severity,
      Long chatMessageId) {}

  /** 실패한 턴 주변의 대화 한 줄. */
  public record Turn(String role, String content) {}

  /** 시뮬레이션 세션 런타임 컨텍스트. */
  public record SessionMeta(
      Long sessionId,
      String executionStatus,
      String currentState,
      String selectedIntentCode,
      String matchedWorkflowCode,
      JsonNode slotValues,
      List<Turn> recentTurns) {}

  /** 골든 케이스 최신 리플레이 결과(있을 때만). */
  public record GoldenReplay(
      Long goldenCaseId,
      Long replayResultId,
      String status,
      String expectedJson,
      String actualJson,
      String failureSummary) {}

  /** 대상 Domain Pack 버전의 압축된 요소 컨텍스트. */
  public record DomainPackContext(
      Long domainPackVersionId,
      List<IntentView> intents,
      List<SlotView> slots,
      List<WorkflowView> workflows,
      List<PolicyView> policies,
      List<RiskView> risks) {}

  public record IntentView(String intentCode, String name, String description) {}

  public record SlotView(String slotCode, String name, String description, String validation) {}

  public record WorkflowView(String workflowCode, String name, String description, String graph) {}

  public record PolicyView(String policyCode, String name, String description, String condition) {}

  public record RiskView(String riskCode, String name, String description, String trigger) {}
}
