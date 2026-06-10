# ML 파이프라인 개선 과정 기록

## 1. 문서 목적

이 문서는 intent discovery 파이프라인이 초기 설계에서 현재 구조에 이르기까지 **어떤 한계를 만나 무엇을 바꿨는지**를 기록한다. 결과물(8단계 파이프라인) 자체보다 그 결정의 근거를 남겨, 이후 같은 문제를 다시 논의할 때 출발점으로 쓰는 것이 목적이다.

전체 시스템 아키텍처와 stage별 책임은 [`architecture.md`](architecture.md) 7장을 함께 참조한다. 본 문서는 "왜 이렇게 바뀌었는가"에 집중한다.

---

## 2. 출발점 — IntentGPT 기반 few-shot intent discovery

초기 설계는 **IntentGPT: Few-Shot Intent Discovery with Large Language Models**의 접근에서 출발했다. 가져온 핵심 아이디어는 소량의 예시와 LLM의 의미 이해 능력으로 상담 발화 묶음에서 잠재 intent를 발견하고, 각 cluster를 대표하는 exemplar와 label 후보를 만드는 것이다.

초기에는 이 구조만으로도 상담 로그의 반복 패턴을 어느 정도 추출할 수 있었다. 문제는 추출된 결과를 **그대로 운영 지식으로 쓸 수 없다**는 데서 드러났다.

---

## 3. 한계 — intent label만으로는 운영 지식이 되지 않는다

few-shot LLM intent discovery를 실제 고객지원 운영 지식으로 쓰기에는 두 가지 한계가 분명했다.

1. **label은 처리 절차를 담지 못한다.** intent label("카드 분실 신고")만으로는 상담사가 어떤 정보를 물어야 하는지(slot), 어떤 정책을 확인해야 하는지(policy), 어디서 사람에게 넘겨야 하는지(handoff)를 알 수 없다.
2. **의미가 같아도 처리 흐름이 다르면 분리되어야 한다.** semantic similarity로는 한 덩어리로 묶이지만 실제 처리 절차가 다른 상담은, 서로 다른 workflow entry point로 나뉘어야 한다. label 기준 clustering은 이 경계를 만들지 못한다.

이 두 한계가 이후 모든 설계 변경의 출발점이다.

---

## 4. 확장 — "절차"를 생성 기준에 넣은 8단계 파이프라인

few-shot intent discovery를 끝단으로 두지 않고, 8개 stage로 확장했다. 각 stage는 독립 DAG 태스크이며 산출물(artifact)로 연결된다(구현: `ml/src/pipeline/stages/`).

```
ingestion → preprocessing → representation → intent_discovery
  → flow_splitting → draft_generation → evaluation → publish_candidate
```

한계 3을 해소한 두 가지 핵심 설계 변경은 다음과 같다.

**변경 A — `representation`/`flow_splitting`을 별도 stage로 분리.**
3장의 한계 ②(같은 의미, 다른 절차)를 풀기 위한 결정이다.

- `representation`(`stages/representation`, `preprocessing/flow_signature.py`)은 발화 텍스트만 보지 않고 상담자/고객 role과 대화 진행 순서를 반영한 semantic representation과 **flow signature**를 만든다.
- `intent_discovery`(`stages/intent_discovery`)는 dense embedding + graph community detection으로 semantic 후보군을 만든다.
- `flow_splitting`(`stages/flow_splitting`)은 그 후보군을 다시 **실제 처리 흐름 단위**로 나눈다.

이 분리 덕분에 "무엇을 물었나"뿐 아니라 **"어떤 절차로 해결되나"**가 Domain Pack 생성의 1급 기준이 된다.

**변경 B — `draft_generation`을 구조화 산출물로.**
3장의 한계 ①(label≠운영 지식)을 풀기 위한 결정이다.

`draft_generation`(`stages/draft_generation`)은 intent cluster를 단순 목록이 아니라 slot / policy / risk / **workflow graph** 초안으로 구조화한다(`knowledge_extraction.py`, `workflow_graph.py`). 예를 들어 "카드 분실 신고" cluster의 최종 산출물에는 본인 확인 slot, 분실/정지/해제 정책, 위험 신호, 그리고 START / ACTION / DECISION / HANDOFF / TERMINAL 노드로 이어지는 workflow가 함께 담긴다.

마지막으로 `evaluation`이 품질을 게이팅하고(5장), `publish_candidate`(`stages/publish_candidate`)가 Spring Backend가 review 작업으로 이어받을 artifact 형태로 정리한다.

---

## 5. 평가 게이트 — 운영자에게 넘길 만한 초안인가

`evaluation` stage(`stages/evaluation`)는 초안을 무조건 publish하지 않고, 세 지표로 "운영자가 검토할 만한 수준인지"를 판정한다. 임계값 미달 초안은 게이트에서 걸러지거나 review 우선순위가 낮게 제안된다(`gates.py`, `thresholds.py`, `metrics.py`).

| 지표 | 의미 | 정의(요약) |
| --- | --- | --- |
| **mapping rate** | intent와 workflow가 정합하게 연결된 비율 | discovered intent code를 가진 workflow 수 / 전체 workflow 수 (`_mapping_rate`) |
| **outlier rate** | 어떤 cluster에도 안정적으로 속하지 못한 발화 비율 | 낮을수록 군집 경계가 명확 |
| **workflow separability** | 분리된 workflow들이 실제로 구분되는 정도 | 높을수록 `flow_splitting`의 경계가 유효 |

추가로 `graph_validation.py`가 workflow graph의 구조 유효성(도달 불가 노드, 누락된 terminal 등)을 검증한다. 즉 평가는 단일 점수가 아니라 **품질 게이트 + review 우선순위 제안 + graph 구조 검증**의 묶음이다.

---

## 6. 가장 큰 품질 보정 축 — 검토 결과를 다시 학습으로 (구현된 피드백 루프)

자동 clustering이나 prompt 조정만으로는 모든 경계를 안정적으로 잡기 어렵다. 상담 로그에는 암묵적 정책, 예외 처리, 조직별 표현 습관, 위험 상황의 handoff 기준이 섞여 있기 때문이다. 그래서 가장 큰 품질 상승분은 **human-in-the-loop**에서 나온다 — 다만 이것은 단순 QA가 아니라 **검토 결정을 다음 실행의 제약으로 되먹이는 closed-loop**로 구현돼 있다.

```
운영자 검토 결정 (review)
   │  same_intent / separate / same_workflow / separate_workflow ...
   ▼
feedback_constraints  ──정규화──▶  must_link · cannot_link (intent)
   │                                same_workflow · separate_workflow (workflow)
   ▼
intent_discovery clustering / flow_splitting 에 제약으로 재주입
   │  (load_feedback_constraints_from_env → clustering(constraints=...))
   ▼
evaluation feedback_replay_diff  ──▶  피드백 반영 전후 품질 차이 측정
   │
   ▼
feedback_candidate_generation  ──▶  경계가 모호한 지점을 골라
                                    다음 검토 질문(INTENT_BOUNDARY /
                                    WORKFLOW_BOUNDARY)으로 운영자에게 제시
```

구현 근거:

- **검토 결정의 제약 변환** — `intent_discovery/feedback_constraints.py`가 backend가 emit한 review 결정을 `must_link`/`cannot_link`(intent), `same_workflow`/`separate_workflow`(workflow) constraint로 정규화한다.
- **clustering에 재주입** — `intent_discovery/main.py`는 `load_feedback_constraints_from_env()`로 제약을 읽어 clustering에 `constraints=`로 전달하고, 적용 개수를 manifest(`feedbackConstraintCount`)에 남긴다. flow 경계 보정은 `flow_splitting/workflow_feedback.py`가 담당한다.
- **효과 측정** — `evaluation/feedback_replay_diff.py`가 피드백 반영 전후의 결과 차이를 측정해, 검토가 실제로 품질을 바꿨는지 확인한다.
- **능동적 질문 생성(active learning)** — `feedback_candidate_generation`은 경계가 모호한 후보를 골라 운영자에게 물을 boundary 질문(`INTENT_BOUNDARY`/`WORKFLOW_BOUNDARY`)을 자동 생성한다. 무작정 다 보여주지 않고, **결정이 가장 큰 영향을 주는 지점**에 검토 노력을 집중시킨다.

핵심은 검토가 일회성 수정에서 끝나지 않고, **constraint로 정규화되어 다음 실행의 군집·분할 경계를 직접 바꾼다**는 점이다. intent 병합/분리, slot 필수 여부, policy 조건, workflow 전이 보정이 그대로 다음 파이프라인 실행의 입력이 된다.

---

## 7. 향후 — 검토 데이터 축적 후 fine-tuning

6장의 closed-loop는 검토 결정을 **제약(constraint)**으로 되먹인다. 그 위에 쌓이는 검토 이력(반복 수정한 intent label, slot 정의, workflow 전이, 반려 사유)은 다음 단계의 학습 재료가 된다.

같은 도메인의 검토 데이터가 충분히 축적되면 LLM **fine-tuning 또는 preference tuning**이 더 효과적인 경로가 될 수 있다. 다만 현재 구현은 처음부터 fine-tuning된 모델을 전제하지 않는다. 데이터가 적은 초기 단계에서는 "파이프라인이 후보를 만들고 → 사람이 검토로 품질을 끌어올리며 → 검토 결과가 제약으로 되먹여지고 → 그 이력이 다음 개선의 학습 재료가 되는" 구조가 더 현실적이라고 보았다. fine-tuning은 이 루프를 대체하는 것이 아니라, 데이터가 쌓인 뒤 루프 안의 후보 생성 품질을 끌어올리는 다음 단계다.

---

## 8. 결정 요약

| 결정 | 한계/동기 | 변경 | 근거 모듈 |
| --- | --- | --- | --- |
| 절차를 생성 기준에 추가 | label은 처리 흐름을 못 담음 | `representation`·`flow_splitting` 분리, flow signature 도입 | `stages/representation`, `stages/flow_splitting` |
| 구조화된 초안 생성 | label≠운영 지식 | slot/policy/risk/workflow graph로 구조화 | `stages/draft_generation` |
| 게이트 기반 평가 | 모든 초안을 사람에게 넘길 수 없음 | mapping/outlier/separability + graph 검증 | `stages/evaluation` |
| 검토를 제약으로 되먹임 | 자동화만으로 경계가 불안정 | must/cannot-link, same/separate-workflow 재주입 | `feedback_constraints.py`, `feedback_replay_diff.py` |
| 능동적 검토 질문 | 검토 노력의 집중 필요 | boundary 질문 자동 생성 | `stages/feedback_candidate_generation` |
| fine-tuning은 향후 | 초기 데이터 부족 | 루프로 데이터 축적 후 전환 | — (계획) |
