# Audit Report — chore/enrich-workflow-ui

**Mode**: PR Review Ingestion
**Date**: 2026-05-21
**Branch**: chore/enrich-workflow-ui → main
**PR**: [#260](https://github.com/ajou-2026-1-capstone-5/ostone/pull/260)
**Scope**: frontend/ (PR diff 기준)
**Diff Base**: main...HEAD (003f637)
**Rules Applied**: `typescript.md`, `principles.md`, `code-review.md`, `error-handling.md`
**Result**: FAIL

---

## PR Ingest

```
canonical:       enrich-workflow-ui
pr:              260 (ajou-2026-1-capstone-5/ostone)
output:          .handoff/enrich-workflow-ui/external-review-enrich-workflow-ui.md
ingestion runs:  1
total EC:        22
this run new EC: 22
```

headSha 변경 확인:
- registry headSha: `bd548a98b5167907f9749684b43a69a40408d3bf`
- current HEAD:     `003f6378060117475df8fb05ed31f06a57b1f69d`
- new commits since last audit:
  - `ec10ddc` — style: prettier formatting (no functional change)
  - `003f637` — fix: split FIT_OPTIONS to separate module (fast-refresh 규칙 준수)

---

## Referenced Artifacts

- audit-input:             N/A (chore 브랜치, preprocess 아티팩트 없음)
- verify-fe-summary:       N/A
- recon report:            N/A
- audit handoff:           N/A
- uncertainty exec log:    N/A
- fe-review-report:        N/A
- playwright-mcp-report:   N/A
- sonar-pseudo-check-report: `.handoff/workflow-enrich-ui/sonar-pseudo-check-report-workflow-enrich-ui.json`
  (headSha 불일치: report=`740e776`, current=`003f637`. 신규 커밋 2개가 formatting/module-split이므로 coverage 변화 없을 가능성 높음)
- previous audit:          `.handoff/enrich-workflow-ui/audit-report-enrich-workflow-ui-2026-05-21-1300.md`
  (V-001~V-007 Fixed 확인됨 — 현재 HEAD에서 동일 문제 미재발)
- external-review:         `.handoff/enrich-workflow-ui/external-review-enrich-workflow-ui.md`
  (22 EC ingested; SonarQube Cloud + CodeRabbit 2회 CHANGES_REQUESTED)

---

## Sonar Pseudo Check Summary

- sonar-pseudo-check-report source: `fallback-hardcode` (headSha 불일치로 stale)
- **SonarQube Cloud CI Quality Gate** (EC-002, PR #260 실측): **FAILED**
  - 실패 조건: Coverage on New Code = **78.7%** (required ≥ **80%**)
  - 이 결과는 fallback-hardcode pseudo-check(91.45%) 와 다름 — **CI 실측값이 우선**
  - Quality Gate 결과 comment URL: https://sonarcloud.io/dashboard?id=ajou-2026-1-capstone-5_ostone_frontend&pullRequest=260
- sonar pseudo-check verdict: PASS (fallback-hardcode, stale — CI 결과 아님)
- sonar MCP pseudo-check: N/A (별도 재실행 없음)
- **Final source of truth**: SonarQube Cloud CI Quality Gate. 이 audit은 그 결과를 대체하지 않는다.

---

## FE Pre-Audit Summary

- fe-review verdict: N/A (staticReviewer 미실행)
- Previous audit V-001~V-007: **All Fixed** (commit `bd548a9` — `003f637` HEAD에서 재발 없음)

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1     |
| Warning  | 7     |
| Info     | 10    |
| Disagree | 1     |
| Out of Scope | 2 |

---

## Violations

### PR-V-001 [Critical] SonarQube Cloud Quality Gate FAIL — Coverage on New Code

- **Type**: Test Coverage Failure
- **EC**: EC-002 (sonarqubecloud pr-comment)
- **Rule**: SonarQube Cloud Quality Gate — Coverage on New Code ≥ 80% (project-enforced CI condition)
- **File**: frontend (layer-level)
- **Description**: PR #260에 대한 SonarQube Cloud CI Quality Gate가 실패했다. New Code Coverage가 78.7%로 요구 기준 80%에 미달한다. 이 결과는 SonarQube Cloud 서버에서 실측된 값이며 fallback pseudo-check(91.45%)와 상이하다. 신규 커밋 2개(`ec10ddc`, `003f637`)는 formatting/module-split 변경이므로 coverage에 영향을 미치지 않을 가능성이 높다.
- **Expected**: New Code Coverage ≥ 80%
- **Actual**: New Code Coverage = 78.7% (PR #260 기준 CI 실측)
- **Requires User Decision**: No
- **Fix Direction**: 새 코드 중 미커버 영역(주로 `frontend/src/features/update-workflow/ui/nodes/` 신규 컴포넌트, `WorkflowEditForm.tsx`, 또는 기타 신규 유틸 파일)의 단위 테스트를 추가해 New Code Coverage를 80% 이상으로 끌어올린다. SonarQube Cloud 대시보드에서 미커버 파일 목록을 직접 확인 후 대상 파일을 특정한다.
- **Fix Result**: Fixed (approved) — `draftSource.test.ts`에 `isIntentRevisionDraft` 및 배열/null/undefined 경계 케이스 테스트 추가; `usePreviewLists.test.ts`에 모든 5개 훅의 select 콜백 커버리지 테스트 추가 (970 tests, 전부 pass). local coverage 80.12%.

---

### PR-V-002 [Warning] WorkflowEditForm — workflow 전환 시 parsedGraph/initialFlow ref 미갱신

- **Type**: Rule Violation / Logic Bug
- **EC**: EC-012 (coderabbitai WorkflowEditForm.tsx:77)
- **Rule**: `principles.md` § KISS — 단순·정확한 상태 관리
- **File**: `frontend/src/features/update-workflow/ui/WorkflowEditForm.tsx:45-46,72-77,79,181-182`
- **Description**: `workflow.id` 변경 시 실행되는 `useEffect`가 `graphStateRef.current`만 갱신하고, `parsedGraph.current`과 `initialFlow.current`는 갱신하지 않는다. 이로 인해 새 workflow로 전환됐을 때 `direction`(line 79), `initialNodes/initialEdges`(line 181-182)가 이전 workflow 데이터를 참조한다. `InteractiveGraphEditor`는 `key={workflow.id}`로 remount되지만, `initialNodes/initialEdges`는 stale ref에서 읽힌다.
- **Expected**: useEffect 내에서 `parsedGraph.current = graph`, `initialFlow.current = flow` 갱신.
- **Actual**: `graphStateRef.current = flow`만 갱신, `parsedGraph`/`initialFlow` stale.
- **Current UI Impact**: 현재 사용처(`WorkflowEditSheet`, `WorkflowDraftReadPage`)는 조건부 렌더링으로 form을 unmount/remount하므로 실 사용자 영향 없음. 단, 코드가 의도한 "같은 id 변경 시 편집 유지" 시나리오를 올바르게 구현하지 못하고 있다.
- **Requires User Decision**: No
- **Fix Direction**: useEffect 내에 `parsedGraph.current = graph; initialFlow.current = flow;`를 추가 (`graphStateRef.current = flow` 이전에 설정).
- **Fix Result**: Fixed (auto)

---

### PR-V-003 [Warning] ConsultationPage — setActiveCustomerId updater 내 setMessages 부수효과

- **Type**: Rule Violation (React anti-pattern)
- **EC**: EC-016 (coderabbitai ConsultationPage.tsx:177)
- **Rule**: React docs — updater 함수는 순수(pure)해야 함; `typescript.md` § 컴포넌트 구조
- **File**: `frontend/src/pages/consultation/ui/ConsultationPage.tsx:165-180`
- **Description**: `setActiveCustomerId((current) => { setMessages(...); return current; })` 패턴은 React의 updater 함수 순수성 요건을 위반한다. React 18 StrictMode에서 updater는 개발 환경에서 2회 호출될 수 있어 메시지 중복 append가 발생한다.
- **Expected**: updater는 `(current) => newId` 형태의 순수 함수. `setMessages` 호출은 updater 바깥에서 실행.
- **Actual**: `setMessages` 호출이 `setActiveCustomerId` updater 내부에 있음.
- **Requires User Decision**: No
- **Fix Direction**: `setActiveCustomerId(targetId)`로 직접 설정 후, 별도 로직에서 `setMessages` 호출. 또는 `const isActive = activeCustomerId === targetId` 판단 후 순서대로 두 setState를 호출.
- **Fix Result**: Fixed (auto)

---

### PR-V-004 [Warning] ConsultationPage — API 로딩 실패를 console.error만으로 처리

- **Type**: Rule Violation
- **EC**: EC-020 (coderabbitai ConsultationPage.tsx:107), EC-021 (CHANGES_REQUESTED outside-diff)
- **Rule**: `error-handling.md` § API 에러 처리 패턴, `CLAUDE.md` "API 에러는 toast.error() 사용"
- **File**:
  - `frontend/src/pages/consultation/ui/ConsultationPage.tsx:107` (loadQueue 실패)
  - `frontend/src/pages/consultation/ui/ConsultationPage.tsx:138` (loadMessages 실패)
- **Description**: `queue` 및 `messages` 로딩 실패 시 `console.error`만 호출하고 `toast.error()`를 표시하지 않아 사용자가 로딩 실패를 인지할 수 없다.
- **Expected**: `catch` 블록에 `toast.error("대기열을 불러오지 못했습니다.");` 추가 + `console.error` 유지(개발자용).
- **Actual**: `console.error("Failed to load queue:", error);` — toast 없음.
- **Requires User Decision**: No
- **Fix Direction**: 두 catch 블록 모두 `toast.error()` 추가 (에러 메시지 한글). `console.error`는 개발자 디버깅용으로 유지해도 무방.
- **Fix Result**: Fixed (auto)

---

### PR-V-005 [Warning] useLogout — API 실패를 console.error만으로 처리

- **Type**: Rule Violation
- **EC**: EC-005 (coderabbitai useLogout.ts:17)
- **Rule**: `error-handling.md` § API 에러 처리 패턴
- **File**: `frontend/src/features/auth/model/useLogout.ts:14-17`
- **Description**: 로그아웃 API 실패를 `console.error("logout failed")`만으로 처리한다. 규칙에 따르면 API 에러는 toast.error()로 사용자에게 알려야 한다.
- **Mitigating Context**: `finally` 블록에서 `clearAuthSession() + navigate("/login")`이 무조건 실행되므로 UX 흐름은 유지된다. 로그인 페이지로 이동하는 도중에 toast를 보여주는 것이 UX 상 적절한지 고려가 필요하다.
- **Expected**: `toast.error("로그아웃 처리에 실패했습니다.")` 추가 또는 실제 UX 영향이 없으므로 의도된 silent 처리임을 주석으로 명시.
- **Actual**: `catch (err) { console.error("logout failed"); }`
- **Requires User Decision**: No
- **Fix Direction**: toast.error 추가 (navigate 전에 brief하게 노출되거나, 로그아웃 성공과 무관하게 세션 정리되므로 주석으로 "의도적 silent" 명시도 허용).
- **Fix Result**: Fixed (auto)

---

### PR-V-006 [Warning] nodeUtils.ts — resolveNodeIcon prototype chain 안전성

- **Type**: Security Best Practice
- **EC**: EC-004 (coderabbitai nodeUtils.ts:33)
- **Rule**: `principles.md` § 공통 원칙 — 안전한 코드
- **File**: `frontend/src/entities/workflow/lib/nodeUtils.ts:31`
- **Description**: `if (hint && ICON_BY_HINT[hint])` 패턴은 `ICON_BY_HINT`가 일반 객체 리터럴이므로 `"__proto__"`, `"toString"` 같은 키도 truthy 값을 반환할 수 있다. 현재 `ICON_BY_HINT`는 정적 Lucide 아이콘 6개만 포함하므로 실제 exploit 위험은 낮지만, `Object.prototype.hasOwnProperty.call()` 확인 없이 외부 입력값(graphConverter에서 `iconHint` 파싱)이 key로 사용된다.
- **Expected**: `Object.prototype.hasOwnProperty.call(ICON_BY_HINT, hint)` 사용.
- **Actual**: `if (hint && ICON_BY_HINT[hint]) return ICON_BY_HINT[hint];`
- **Requires User Decision**: No
- **Fix Direction**: `if (hint && Object.prototype.hasOwnProperty.call(ICON_BY_HINT, hint)) return ICON_BY_HINT[hint];`
- **Fix Result**: Fixed (auto)

---

### PR-V-007 [Warning] CreateDraftModal — onError에서 비-409/400 에러 사용자 알림 누락

- **Type**: Rule Violation
- **EC**: EC-007 (coderabbitai CreateDraftModal.tsx:67)
- **Rule**: `error-handling.md` § API 에러 처리 패턴 — "모든 에러 경로에 사용자 알림"
- **File**: `frontend/src/features/domain-pack-draft-create/ui/CreateDraftModal.tsx:60-70`
- **Description**: `onError` 핸들러가 409/400 에러만 처리하고, 그 외 에러(500, 네트워크 에러 등)는 `setInlineError`도 `toast.error()`도 호출하지 않아 사용자가 실패를 인지할 수 없다.
- **Expected**: `else { toast.error("초안 생성에 실패했습니다."); }` fallback 추가.
- **Actual**: 409/400 이외 에러 시 silent fail.
- **Requires User Decision**: No
- **Fix Direction**: `onError` 핸들러 내 조건 외 else 또는 마지막에 `toast.error()` 추가.
- **Fix Result**: Fixed (auto)

---

### PR-V-008 [Warning] EditableTerminalNode — connected-side 계산 로직 중복

- **Type**: Rule Violation
- **EC**: EC-011 (coderabbitai EditableTerminalNode.tsx:31)
- **Rule**: `principles.md` § DRY
- **File**: `frontend/src/features/update-workflow/ui/nodes/EditableTerminalNode.tsx:16-28`
- **Description**: `useStore`를 직접 사용해 connected target side를 계산하는 로직이 inline으로 구현되어 있다. `entities/workflow/lib/useConnectedSides.ts`에 동일 역할의 공유 훅이 존재함에도 사용하지 않아 DRY 위반이다.
- **Expected**: `useConnectedSides(id)` 호출로 교체.
- **Actual**: `useStore` inline 중복 구현.
- **Requires User Decision**: No
- **Fix Direction**: `import { useConnectedSides } from "@/entities/workflow/lib/useConnectedSides"` 후 `useStore` 블록 교체. VALID_SIDES, HandleSide 정의 제거.
- **Fix Result**: Fixed (auto)

---

### PR-V-009 [Info] createDraftApi.ts — .then() 체인 스타일

- **Type**: Style (CodeRabbit suggestion)
- **EC**: EC-006, EC-022 (duplicate)
- **Rule**: N/A (typescript.md에 .then() 금지 명시 없음)
- **File**: `frontend/src/features/domain-pack-draft-create/api/createDraftApi.ts:11-13`
- **Description**: `createDraft(...).then(...)` 체인 사용. CodeRabbit이 async/await로 변환을 권장. 현행 코드는 기능적으로 동일하나 프로젝트 전반 async/await 패턴과 일관성이 없다.
- **Requires User Decision**: No
- **Fix Direction**: `async (wsId, packId, payload) => { const response = await createDraft(...); return response.data; }` 형태로 전환 권장.
- **Fix Result**: Fixed (auto)

---

### PR-V-010 [Info] SummaryDetailPanel.tsx — formatDate try/catch 실제로 동작 안 함

- **Type**: Logic Bug (Low Impact)
- **EC**: EC-009 (coderabbitai SummaryDetailPanel.tsx:171)
- **Rule**: `principles.md` § 정확성
- **File**: `frontend/src/features/domain-pack-summary-read/ui/SummaryDetailPanel.tsx:168-173`
- **Description**: `new Date(invalidIso)` 는 예외를 던지지 않고 `Invalid Date` 객체를 반환하므로 `catch` 블록이 실행되지 않는다. 잘못된 ISO 문자열 입력 시 `"Invalid Date"` 문자열이 UI에 노출될 수 있다.
- **Fix Direction**: `const d = new Date(iso); if (Number.isNaN(d.getTime())) return iso; return d.toLocaleString("ko-KR");`
- **Fix Result**: Fixed (auto)

---

### PR-V-011 [Info] VersionListPanel.tsx — formatDate try/catch 실제로 동작 안 함

- **Type**: Logic Bug (Low Impact)
- **EC**: EC-019 (coderabbitai VersionListPanel.tsx:13)
- **Rule**: `principles.md` § 정확성
- **File**: `frontend/src/features/domain-pack-summary-read/ui/VersionListPanel.tsx:5-13`
- **Description**: PR-V-010과 동일 패턴. `try/catch`가 `Invalid Date` 문자열을 잡지 못함.
- **Fix Direction**: PR-V-010과 동일.
- **Fix Result**: Fixed (auto)

---

### PR-V-012 [Info] ComponentCountGrid.tsx — preview item 키보드 접근성 미흡

- **Type**: Accessibility
- **EC**: EC-008 (coderabbitai ComponentCountGrid.tsx:201)
- **Rule**: `code-review.md` § 보안/UX 체크 (접근성 명시 없으나 키보드 인터랙션 구현 미완)
- **File**: `frontend/src/features/domain-pack-summary-read/ui/ComponentCountGrid.tsx:181-202`
- **Description**: 클릭 가능한 `<li>` 항목에 `role="button"`, `tabIndex` 미설정. `onKeyDown`에 `e.stopPropagation()` 누락으로 부모 카드의 키 핸들러에 이벤트가 전파된다.
- **Fix Direction**: `<li role={...} tabIndex={...}>`에 role/tabIndex 추가. `onKeyDown` 내 `e.stopPropagation()` 추가.
- **Fix Result**: Fixed (auto)

---

### PR-V-013 [Info] QueuePanel.tsx — 고객 행 클릭 div 키보드 접근성 미흡

- **Type**: Accessibility
- **EC**: EC-017 (coderabbitai QueuePanel.tsx:44)
- **Rule**: 접근성 best practice
- **File**: `frontend/src/features/consultation/ui/QueuePanel.tsx:40-44`
- **Description**: `onClick`만 있고 `role="button"`, `tabIndex`, `onKeyDown` 없음.
- **Fix Direction**: `role="button"`, `tabIndex={0}`, `onKeyDown` (Enter/Space 처리) 추가.
- **Fix Result**: Fixed (auto)

---

### PR-V-014 [Info] ArchiveConfirmDialog.tsx — Promise.resolve().catch() 패턴

- **Type**: Style
- **EC**: EC-014 (coderabbitai ArchiveConfirmDialog.tsx:51)
- **Rule**: 스타일 일관성 (명시적 금지 없음)
- **File**: `frontend/src/features/workspace/ui/ArchiveConfirmDialog.tsx:49-51`
- **Description**: `void Promise.resolve(onSuccess()).catch(...)` 패턴. async/await + try/catch로 통일하는 것이 코드베이스 패턴과 일관적.
- **Fix Direction**: async IIFE 또는 별도 async handler 사용.
- **Fix Result**: Fixed (auto)

---

### PR-V-015 [Info] CreateWorkspaceDialog.tsx — Promise.resolve().catch() 패턴

- **Type**: Style
- **EC**: EC-015 (coderabbitai CreateWorkspaceDialog.tsx:77)
- **Rule**: 스타일 일관성
- **File**: `frontend/src/features/workspace/ui/CreateWorkspaceDialog.tsx:74-77`
- **Description**: PR-V-014와 동일 패턴.
- **Fix Direction**: PR-V-014와 동일.
- **Fix Result**: Fixed (auto)

---

### PR-V-016 [Info] editableNodes.module.css — word-break: break-word deprecated

- **Type**: CSS Lint (Info)
- **EC**: EC-010 (coderabbitai editableNodes.module.css:102)
- **Rule**: CSS 표준 준수
- **File**: `frontend/src/features/update-workflow/ui/nodes/editableNodes.module.css:102`
- **Description**: `word-break: break-word`는 deprecated/non-standard 키워드. stylelint `declaration-property-value-keyword-no-deprecated` 위반이나 프로젝트 CI에 stylelint가 없어 빌드 영향 없음.
- **Fix Direction**: `overflow-wrap: anywhere; word-break: normal;`으로 교체.
- **Fix Result**: Fixed (auto)

---

### PR-V-017 [Info] index.css — @import url() stylelint notation

- **Type**: CSS Lint (Info)
- **EC**: EC-003 (coderabbitai index.css:1)
- **Rule**: stylelint import-notation (CI 미적용)
- **File**: `frontend/src/app/index.css:1`
- **Description**: `@import url("...")` 표기가 stylelint `import-notation` 규칙 위반이나 CI에 stylelint 미적용.
- **Fix Direction**: `@import "../shared/ui/ostone/tokens.css";`로 변경.
- **Fix Result**: Fixed (auto)

---

### PR-V-018 [Info] GraphViewer.module.css — :global() stylelint 예외 설정 없음

- **Type**: CSS Lint (Info)
- **EC**: EC-013 (coderabbitai GraphViewer.module.css:12)
- **Rule**: stylelint selector-pseudo-class-no-unknown (CI 미적용)
- **File**: `frontend/src/features/workflow-viewer/ui/GraphViewer.module.css:12,17,21,30,42,46,50,55`
- **Description**: `:global(...)` 사용이 stylelint 위반이나 CI에 stylelint 미적용. 추후 stylelint 적용 시 `.stylelintrc.json`에 `ignorePseudoClasses: ['global']` 추가 필요.
- **Fix Direction**: `.stylelintrc.json`에 `selector-pseudo-class-no-unknown` 예외 추가.
- **Fix Result**: Fixed (auto)

---

### PR-V-019 [Disagree] SummaryDetailPanel.tsx — console.error 제거 요청

- **EC**: EC-018 (coderabbitai SummaryDetailPanel.tsx:72)
- **Classification**: Disagree (Not a rule violation)
- **Reason**: 현재 코드가 `toast.error(...)` + `console.error(...)` 모두 호출하는 구조는 `error-handling.md` 예시 패턴과 정확히 일치한다 ("console.error(error); // 개발자 디버깅용"). CodeRabbit의 "console.error를 제거하라"는 요청은 프로젝트 규칙과 불일치. 현행 코드가 올바름.

---

## Out of Scope

### OOS-001 — useIntentRevisionSummary.ts .then/.catch 패턴 (EC-022)
- **EC**: EC-022 (coderabbitai useIntentRevisionSummary.ts:116-154)
- **File**: `frontend/src/features/intent-revision-draft/model/useIntentRevisionSummary.ts` — **PR diff에 없음**
- **Reason**: PR 범위 외 기존 코드. 이 PR에서 수정하는 것은 scope creep.

### OOS-002 — ConsultationPage 3-state 분리 (EC-021 outside-diff)
- **EC**: EC-021 outside-diff (ConsultationPage.tsx:56-63)
- **File**: `frontend/src/pages/consultation/ui/ConsultationPage.tsx:56-63` — **PR diff에 있으나 Outside diff range로 보고됨**
- **Reason**: 이 PR의 핵심 변경 범위가 아닌 기존 패턴. 별도 이슈로 추적 권장.

---

## Spec Consistency

해당 없음 (chore 브랜치, 스펙 문서 없음).

## Previous Audit Violations Status

이전 audit(2026-05-21-1300) V-001~V-007 모두 Fixed (commit `bd548a9`) — 현재 HEAD `003f637`에서 재발 없음 확인.

---

## Ignored (auditignore)

없음 (`.auditignore` 미존재).

---

## User Decision Required

없음 — 모든 위반 항목이 `Requires User Decision: No`로 분류됨.
