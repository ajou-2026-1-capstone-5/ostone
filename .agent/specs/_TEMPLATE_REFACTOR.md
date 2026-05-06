# Refactor Spec — {canonical}

> 이 템플릿은 누적 기술 부채 청산용. 동작을 변경하지 않는 작업이 default.
> 구조적 변경(클래스 분리, 인터페이스 추출 등)이 필요하면 `Structural Change Required: Yes`로 표시.
>
> 본 spec은 inspection-driven. `${SHARED_5STONE}/scripts/inspection-to-spec.py` helper로 자동 변환 가능.
> 변환 후 사용자 검토/편집을 거쳐 `spec/{canonical}` branch에서 commit.

**Type**: Refactor

---

## Goal

(1줄. 무엇을 해소하는가. 예: "`_build_workflow_draft` 함수 길이 50줄 가이드라인 정합성 회복")

---

## Source

- audit-report-inspection: `.handoff/_inspection/audit-report-inspection-{YYYY-MM-DD-HHmm}.md`
- sonar-inspection-report: `.handoff/_inspection/sonar-inspection-report-{YYYY-MM-DD-HHmm}.json`
- Selected Batch: `B-NNN` — <batch title>

---

## Behavior Statement

- **Behavior-Preserving Statement**: 이 작업은 동작을 변경하지 않는다. 기존 테스트 그대로 PASS가 곧 수용 기준.
- **Structural Change Required**: `No`
  - `No` → codeRemediator (Track 1)만으로 처리 가능
  - `Yes` → codeBuilder + codeRemediator (Track 2). 변경 본문은 아래 "Structural Change" 섹션에 명시

---

## Scope

| File | Issue ID / Rule | Type | Severity |
|---|---|---|---|
| `<path>:<line>` | SONAR-`<rule>` 또는 V-`NNN` | Function Length / Naming / ... | Warning / Critical |

`Scope`의 file/issue id는 inspection-report에서 인용. specGatekeeper SC-R2가 실재성 검증.

---

## Done Criteria

- [ ] Selected sonar/audit issue 0건 (count 측정 가능)
- [ ] 모든 기존 테스트 그대로 통과 (no regression)
- [ ] (선택) Quality Gate level: OK 유지 또는 ERROR → OK
- [ ] (선택) newCoverage ≥ {threshold}%

`Done Criteria`는 측정 가능해야 한다 (sonar issue count, quality gate level, test result, coverage 임계 중 1개 이상). specGatekeeper SC-R3가 측정 가능성 검증.

---

## Out of Scope

- 동작 변경 (`Structural Change Required: Yes`인 경우 본문 "Structural Change" 섹션에 명시한 변경만 허용)
- inspection-report에 등재되지 않은 file 수정
- (구체 명시 — 예: "이 batch와 무관한 import 정리 / naming 변경 / 무관 영역 리팩토링")

---

## Structural Change (`Structural Change Required: Yes`인 경우만 작성)

> No인 경우 본 섹션 생략 또는 N/A.

**Change**: <구조적 변경 1~3줄. 예: "PolicyResolver를 별도 class로 분리. 기존 단일 service에서 호출 위임">

**Justification**: <왜 구조 변경이 필요한가. spec-impl 요구가 아니라면 engineering rationale.>

**Affected Modules**:
- `<module 1>`: <변경 요지>
- `<module 2>`: <변경 요지>

**Behavior Equivalence Proof**: <기존 동작 보존을 어떻게 보장하는가. 예: "기존 service의 public API 시그니처 동일 + 기존 테스트 통과">

---

## Notes

- Lean refactor spec이므로 sequence diagram / REST API / DB Migration 섹션 미포함. 신규 기능 spec에는 `_TEMPLATE_BE.md` / `_TEMPLATE_FE.md` / `_TEMPLATE_ML.md` 사용.
- specGatekeeper `--mode=refactor`로 SC-R0~R3 검사 가능.
- branch convention은 `spec/{canonical}` (이 spec 작성용) → `fix/{canonical}-{description}` (구현용) 그대로 활용.
