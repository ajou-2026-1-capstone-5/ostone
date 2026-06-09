package com.init.workflowruntime.domain;

import java.util.List;

/**
 * 시뮬레이션 근거로부터 도출된 구조적 Domain Pack 패치 문서({@code simulation-structural-patch.v1}). 검증을 통과한 인스턴스는 스키마
 * 버전, evidence, 비어있지 않은 operation 목록을 보장한다. 이 타입은 계약(contract)만 표현하며 어떤 DB 변경도 수행하지 않는다.
 */
public record StructuralDomainPackPatch(
    String schemaVersion,
    String summary,
    StructuralPatchEvidence evidence,
    List<StructuralPatchOperation> operations) {

  public static final String SCHEMA_VERSION = "simulation-structural-patch.v1";

  public StructuralDomainPackPatch {
    if (!SCHEMA_VERSION.equals(schemaVersion)) {
      throw new InvalidStructuralPatchException("지원하지 않는 schemaVersion입니다: " + schemaVersion);
    }
    if (evidence == null) {
      throw new InvalidStructuralPatchException("evidence는 필수입니다.");
    }
    if (operations == null || operations.isEmpty()) {
      throw new InvalidStructuralPatchException("operations는 최소 1개 이상이어야 합니다.");
    }
    summary = summary == null || summary.isBlank() ? null : summary.strip();
    operations = List.copyOf(operations);
  }
}
