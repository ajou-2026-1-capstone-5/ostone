package com.init.workflowruntime.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.workflowruntime.application.dto.SimulationImprovementEvidence;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.InvalidStructuralPatchException;
import com.init.workflowruntime.domain.SimulationFeedback;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.retry.NonTransientAiException;
import org.springframework.ai.retry.TransientAiException;
import org.springframework.stereotype.Service;

/**
 * 시뮬레이션 근거로부터 LLM이 {@code simulation-structural-patch.v1} 구조적 패치를 생성하게 하고, #879 parser로 검증한다. 모델은
 * 구조화된 패치 JSON만 만들고 Domain Pack 테이블을 직접 변경하지 않는다. 파싱/검증 실패와 모호한 대상은 가짜 패치 대신 명확한 실패 상태로 변환한다.
 */
@Service
public class SimulationStructuralPatchGenerationService {

  private static final Logger log =
      LoggerFactory.getLogger(SimulationStructuralPatchGenerationService.class);

  private final ChatClient chatClient;
  private final SimulationImprovementEvidenceAssembler evidenceAssembler;
  private final SimulationStructuralPatchPromptFactory promptFactory;
  private final StructuralDomainPackPatchParser patchParser;
  private final ObjectMapper objectMapper;

  public SimulationStructuralPatchGenerationService(
      ChatClient chatClient,
      SimulationImprovementEvidenceAssembler evidenceAssembler,
      SimulationStructuralPatchPromptFactory promptFactory,
      StructuralDomainPackPatchParser patchParser,
      ObjectMapper objectMapper) {
    this.chatClient = chatClient;
    this.evidenceAssembler = evidenceAssembler;
    this.promptFactory = promptFactory;
    this.patchParser = patchParser;
    this.objectMapper = objectMapper;
  }

  public SimulationStructuralPatchGenerationResult generate(
      SimulationFeedback feedback, ChatSession session) {
    SimulationImprovementEvidence evidence = evidenceAssembler.assemble(feedback, session);
    String rawContent;
    try {
      rawContent =
          chatClient
              .prompt()
              .system(promptFactory.systemPrompt())
              .user(promptFactory.buildUserPrompt(evidence))
              .call()
              .content();
    } catch (NonTransientAiException | TransientAiException e) {
      log.warn("structural patch generation LLM call failed: {}", e.toString());
      log.debug("structural patch generation failure detail", e);
      return SimulationStructuralPatchGenerationResult.generationError(e.getMessage());
    }
    return interpret(rawContent);
  }

  SimulationStructuralPatchGenerationResult interpret(String rawContent) {
    if (rawContent == null || rawContent.isBlank()) {
      return SimulationStructuralPatchGenerationResult.invalidOutput("LLM이 빈 응답을 반환했습니다.");
    }
    String jsonText = extractJsonObject(rawContent);
    if (jsonText == null) {
      return SimulationStructuralPatchGenerationResult.invalidOutput("응답에서 JSON 객체를 찾을 수 없습니다.");
    }
    JsonNode node;
    try {
      node = objectMapper.readTree(jsonText);
    } catch (JsonProcessingException e) {
      return SimulationStructuralPatchGenerationResult.invalidOutput("응답을 JSON으로 파싱할 수 없습니다.");
    }
    if (!node.isObject()) {
      return SimulationStructuralPatchGenerationResult.invalidOutput("응답은 JSON 객체여야 합니다.");
    }
    if (isNeedsHumanTarget(node)) {
      return SimulationStructuralPatchGenerationResult.needsHumanTarget(readText(node, "summary"));
    }
    try {
      patchParser.parse(jsonText);
      return SimulationStructuralPatchGenerationResult.success(jsonText);
    } catch (InvalidStructuralPatchException e) {
      return SimulationStructuralPatchGenerationResult.invalidOutput(e.getMessage());
    }
  }

  private boolean isNeedsHumanTarget(JsonNode node) {
    JsonNode status = node.get("status");
    return status != null
        && status.isTextual()
        && SimulationStructuralPatchPromptFactory.NEEDS_HUMAN_TARGET.equalsIgnoreCase(
            status.asText().strip());
  }

  private String readText(JsonNode node, String field) {
    JsonNode value = node.get(field);
    if (value == null || value.isNull() || !value.isTextual()) {
      return null;
    }
    return value.asText();
  }

  private String extractJsonObject(String content) {
    int start = content.indexOf('{');
    int end = content.lastIndexOf('}');
    if (start < 0 || end <= start) {
      return null;
    }
    return content.substring(start, end + 1);
  }
}
