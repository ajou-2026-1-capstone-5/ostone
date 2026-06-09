package com.init.workflowruntime.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.workflowruntime.application.dto.NormalizedPatchOperationView;
import com.init.workflowruntime.domain.InvalidStructuralPatchException;
import com.init.workflowruntime.domain.SimulationPatchValidationStatus;
import com.init.workflowruntime.domain.StructuralDomainPackPatch;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * 후보 draft patch JSON을 read-side에서 정규화·검증해 리뷰 화면용 {@link PatchView}로 변환한다. 어떤 DB 접근도 하지 않으며 구조 패치를
 * 적용하지도 않는다. 분류는 NONE → LEGACY → VALID → INVALID 순서로 fail-closed 한다.
 */
@Component
public class SimulationCandidatePatchViewMapper {

  private static final String LEGACY_SCHEMA_VERSION = "simulation-candidate-draft-patch.v1";

  private final StructuralDomainPackPatchParser parser;
  private final ObjectMapper objectMapper;

  public SimulationCandidatePatchViewMapper(
      StructuralDomainPackPatchParser parser, ObjectMapper objectMapper) {
    this.parser = parser;
    this.objectMapper = objectMapper;
  }

  /** 정규화 결과. operations는 VALID일 때만 채워지며, INVALID일 때 errors에 사유가 담긴다. */
  public record PatchView(
      String schemaVersion,
      String summary,
      SimulationPatchValidationStatus validationStatus,
      List<String> errors,
      List<NormalizedPatchOperationView> operations) {

    public PatchView {
      errors = errors == null ? List.of() : List.copyOf(errors);
      operations = operations == null ? List.of() : List.copyOf(operations);
    }
  }

  public PatchView map(String draftPatchJson) {
    if (isEmptyPatch(draftPatchJson)) {
      return none();
    }

    JsonNode root;
    try {
      root = objectMapper.readTree(draftPatchJson);
    } catch (JsonProcessingException e) {
      return invalid(e.getOriginalMessage());
    }
    if (root == null || !root.isObject()) {
      return invalid("patch 문서는 JSON object여야 합니다.");
    }

    if (LEGACY_SCHEMA_VERSION.equals(readText(root, "schemaVersion"))) {
      return legacy(readText(root, "summary"));
    }

    try {
      StructuralDomainPackPatch patch = parser.parse(draftPatchJson);
      return valid(patch);
    } catch (InvalidStructuralPatchException e) {
      return invalid(e.getMessage());
    }
  }

  private boolean isEmptyPatch(String draftPatchJson) {
    if (draftPatchJson == null || draftPatchJson.isBlank()) {
      return true;
    }
    String trimmed = draftPatchJson.trim();
    return "{}".equals(trimmed) || "[]".equals(trimmed) || "null".equals(trimmed);
  }

  private PatchView none() {
    return new PatchView(null, null, SimulationPatchValidationStatus.NONE, List.of(), List.of());
  }

  private PatchView legacy(String summary) {
    return new PatchView(
        LEGACY_SCHEMA_VERSION,
        summary,
        SimulationPatchValidationStatus.LEGACY,
        List.of(),
        List.of());
  }

  private PatchView valid(StructuralDomainPackPatch patch) {
    List<NormalizedPatchOperationView> operations =
        patch.operations().stream().map(NormalizedPatchOperationView::from).toList();
    return new PatchView(
        patch.schemaVersion(),
        patch.summary(),
        SimulationPatchValidationStatus.VALID,
        List.of(),
        operations);
  }

  private PatchView invalid(String message) {
    String error = message == null || message.isBlank() ? "구조 패치를 파싱할 수 없습니다." : message;
    return new PatchView(
        null, null, SimulationPatchValidationStatus.INVALID, List.of(error), List.of());
  }

  private String readText(JsonNode node, String field) {
    JsonNode value = node.get(field);
    if (value == null || value.isNull() || !value.isTextual()) {
      return null;
    }
    String text = value.asText();
    return text.isBlank() ? null : text.strip();
  }
}
