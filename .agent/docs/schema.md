# 상담 로그 기반 CS 워크플로우 생성 시스템 PostgreSQL 스키마 초안

## 1. 문서 목적

이 문서는 현재까지 합의한 시스템 구조를 바탕으로, PostgreSQL 기준의 전체 데이터 스키마 초안을 정리한 문서다.
목적은 다음과 같다.

- Spring Backend에서 사용할 핵심 테이블 구조를 먼저 확정한다.
- Airflow + Python Pipeline이 생성한 산출물을 어떤 형태로 저장할지 기준을 만든다.
- review, runtime, metrics/logging까지 포함한 **운영 가능한 데이터 설계 초안**을 정리한다.
- 이후 JPA 엔티티 설계, Liquibase migration 작성, API/화면 설계의 기준 문서로 사용한다.

---

## 2. 설계 전제

이 프로젝트의 핵심 산출물은 실시간 챗봇이 아니라, 기존 상담 로그로부터 추출한 다음 초안이다.

- intents
- slots
- policies
- risks
- workflows

즉, 개별 답변 로그를 저장하는 시스템보다, **도메인 온보딩에 필요한 domain pack을 생성·검토·배포·실행**하는 시스템에 가깝다.
따라서 스키마도 아래 4가지 흐름을 모두 지원해야 한다.

1. 상담 로그 수집 및 전처리
2. intent discovery / draft generation / evaluation
3. 사람 검토 및 승인
4. publish된 domain pack의 runtime 실행 및 결과 기록

---

## 3. 설계 원칙

### 3.1 PostgreSQL 단일 저장소 우선
- 초기 버전에서는 PostgreSQL을 메인 저장소로 사용한다.
- 별도 KV 저장소(Redis 등)는 초기 필수 요소로 두지 않는다.
- 캐시나 세션 최적화가 실제 병목이 된 후 필요 시 추가한다.

### 3.2 정규화 + JSONB 혼합
- 상태와 수명주기가 중요한 객체는 **정규화 테이블**로 저장한다.
- 구조가 자주 바뀔 수 있는 산출물과 그래프, 메트릭 payload는 **JSONB**로 저장한다.

### 3.3 Domain Pack 중심 설계
- 핵심 배포 단위는 개별 intent나 policy가 아니라 **Domain Pack Version**이다.
- intent / slot / policy / risk / workflow 정의는 pack version 아래에 소속된다.

### 3.4 Review와 Runtime은 별도 컨텍스트로 유지
- review는 단순 승인 플래그가 아니라 작업 흐름과 이력이 있는 독립 영역이다.
- runtime은 domain pack을 읽어 실제 상태 전이를 실행하는 별도 영역이다.

### 3.5 Metrics / Logs를 별도 계층으로 관리
- pipeline 품질 평가, review 비용, runtime 의사결정 근거, drift는 별도 로그 테이블로 관리한다.
- 운영 데이터와 평가 데이터를 섞지 않고 분리한다.

---

## 4. 전체 스키마 구조

논리적으로는 다음 6개 schema로 나눈다.

- `app`: workspace, user, membership
- `corpus`: 상담 로그 원천 및 전처리 데이터
- `pack`: domain pack 및 definition 데이터
- `review`: 검토/승인 작업 데이터
- `pipeline`: Airflow job, artifact, evaluation 데이터
- `runtime`: 채팅 데모, workflow execution, decision log

---

## 5. 테이블 구성 요약

### 5.1 app
- `app.workspace`
- `app.app_user`
- `app.workspace_member`

### 5.2 corpus
- `corpus.dataset`
- `corpus.conversation`
- `corpus.conversation_turn`
- `corpus.conversation_feature_snapshot`

### 5.3 pack
- `pack.domain_pack`
- `pack.domain_pack_version`
- `pack.intent_definition`
- `pack.slot_definition`
- `pack.intent_slot_binding`
- `pack.policy_definition`
- `pack.risk_definition`
- `pack.workflow_definition`
- `pack.intent_workflow_binding`

### 5.4 review
- `review.review_session`
- `review.review_task`
- `review.review_comment`
- `review.review_decision`
- `review.review_activity_log`
- `review.review_summary_metric`

### 5.5 pipeline
- `pipeline.pipeline_job`
- `pipeline.pipeline_job_event`
- `pipeline.pipeline_artifact`
- `pipeline.webhook_receipt`
- `pipeline.evaluation_run`
- `pipeline.evaluation_metric`
- `pipeline.cluster_evaluation`
- `pipeline.novel_intent_candidate`
- `pipeline.taxonomy_drift_log`

### 5.6 runtime
- `runtime.chat_session`
- `runtime.chat_message`
- `runtime.workflow_execution`
- `runtime.workflow_execution_step`
- `runtime.decision_log`
- `runtime.session_outcome`

---

## 6. 테이블별 역할 정리

## 6.1 app

### `app.workspace`
- 시스템의 최상위 작업 단위
- 향후 멀티 워크스페이스 확장 대비
- 모든 핵심 데이터의 소속 기준

### `app.app_user`
- 운영자, 리뷰어, 관리자 등 사용자 정보 저장
- 역할 기반 접근 제어의 기초 데이터

### `app.workspace_member`
- workspace와 user의 연결 정보 저장
- owner/admin/reviewer/operator 등 역할 부여

---

## 6.2 corpus

### `corpus.dataset`
- 업로드되거나 적재된 상담 로그 묶음
- source type, 상태, PII 처리 상태를 관리

### `corpus.conversation`
- conversation 단위의 상담 로그 저장
- channel, language, customer-only text, full text 등 포함

### `corpus.conversation_turn`
- turn 단위 메시지 저장
- speaker role, redacted text, timestamp를 관리

### `corpus.conversation_feature_snapshot`
- 전처리/표현 생성 결과를 conversation 단위로 저장
- canonical text, summary, flow signature, embedding reference 등 저장 가능

---

## 6.3 pack

### `pack.domain_pack`
- 도메인 단위 상위 묶음
- 예: 쇼핑몰 A CS Pack, 서비스 B 고객지원 Pack

### `pack.domain_pack_version`
- 실제 배포/검토 단위
- draft / review / published 상태를 관리
- intent, slot, policy, risk, workflow는 모두 특정 version에 속함

### `pack.intent_definition`
- workflow entry point가 되는 conversation intent 정의
- taxonomy level, parent intent, evidence, source cluster 정보 포함

### `pack.slot_definition`
- intent 처리에 필요한 slot 정의
- data type, validation, sensitive 여부 관리

### `pack.intent_slot_binding`
- intent와 slot의 관계 정의
- 필수 여부, 수집 순서, prompt hint, 조건 저장

### `pack.policy_definition`
- 정책/규칙 정의
- 조건, 강도, action, evidence 저장

### `pack.risk_definition`
- 위험 요소 정의
- trigger condition, handling action, risk level 저장

### `pack.workflow_definition`
- 상태 기반 graph 정의
- `graph_json`을 source of truth로 사용
- initial state / terminal states 저장

### `pack.intent_workflow_binding`
- 특정 intent가 어떤 workflow로 연결되는지 정의
- route condition으로 분기 조건도 표현 가능

---

## 6.4 review

### `review.review_session`
- 하나의 domain pack version에 대해 열린 review 작업 묶음
- session 단위 상태 및 담당자 관리

### `review.review_task`
- intent / slot / policy / workflow 등 개별 검토 대상 작업
- proposed change를 payload로 관리

### `review.review_comment`
- task에 대한 코멘트 기록

### `review.review_decision`
- approve / reject / request_change / merge / split 등 최종 결정 기록

### `review.review_activity_log`
- 검토자가 실제 어떤 작업을 했는지 기록
- 사람 비용 산정에 활용

### `review.review_summary_metric`
- review session 단위의 요약 메트릭 저장
- total review minutes, merge/split 횟수 등

---

## 6.5 pipeline

### `pipeline.pipeline_job`
- Airflow 파이프라인 실행 요청의 중심 객체
- dataset, domain pack, dag id, run id, 상태를 관리

### `pipeline.pipeline_job_event`
- job의 상태 변화 이벤트 저장
- stage 완료, 실패, 재시도 등 기록

### `pipeline.pipeline_artifact`
- 파이프라인 산출물 저장
- canonical text, cluster cards, evaluation report, draft pack 등

### `pipeline.webhook_receipt`
- Airflow 웹훅 원본 수신 기록
- 중복 수신 및 재처리 방어 용도

### `pipeline.evaluation_run`
- 하나의 pipeline 결과에 대한 평가 실행 단위
- training/validation/비교 평가를 묶음

### `pipeline.evaluation_metric`
- 평가 지표 key-value 저장
- mapping rate, outlier rate, workflow separability 등

### `pipeline.cluster_evaluation`
- cluster/intent 후보별 세부 평가 기록
- interpretability, workflow consistency, merge/split 후보 여부 등

### `pipeline.novel_intent_candidate`
- validation/outlier에서 드러난 신규 intent 후보 기록

### `pipeline.taxonomy_drift_log`
- version 간 taxonomy 변경 로그
- 신규/병합/분할/폐기 intent 수 기록

---

## 6.6 runtime

### `runtime.chat_session`
- 데모용 채팅 세션 단위
- 어떤 domain pack version으로 실행되었는지 기록

### `runtime.chat_message`
- 채팅 세션의 메시지 기록
- customer / assistant / operator / system 구분

### `runtime.workflow_execution`
- 실제 workflow 실행 상태 저장
- 현재 state, slot 값, policy/risk snapshot 포함

### `runtime.workflow_execution_step`
- 상태 전이 이력 기록
- ask_slot, answer, handoff, block 등 action 로그 포함

### `runtime.decision_log`
- 특정 step에서 왜 그 결정을 했는지 기록
- intent, missing slots, policy hits, risk hits, evidence 저장

### `runtime.session_outcome`
- 세션 종료 결과 저장
- resolved, handed_off, blocked, abandoned 등 outcome 기록

---

## 7. 전체 DDL 초안

### 7.1 schema 생성

```sql
create schema if not exists app;
create schema if not exists corpus;
create schema if not exists pack;
create schema if not exists review;
create schema if not exists pipeline;
create schema if not exists runtime;
```

### 7.2 app

```sql
create table app.workspace (
    id                  bigserial primary key,
    workspace_key       varchar(100) not null unique,
    name                varchar(255) not null,
    description         text,
    status              varchar(50) not null default 'ACTIVE',
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create table app.app_user (
    id                  bigserial primary key,
    email               varchar(255) not null unique,
    name                varchar(255) not null,
    role                varchar(50) not null default 'OPERATOR',
    status              varchar(50) not null default 'ACTIVE',
    profile_json        jsonb not null default '{}'::jsonb,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create table app.workspace_member (
    id                  bigserial primary key,
    workspace_id        bigint not null references app.workspace(id),
    user_id             bigint not null references app.app_user(id),
    member_role         varchar(50) not null,
    joined_at           timestamptz not null default now(),
    unique (workspace_id, user_id)
);
```

### 7.3 corpus

```sql
create table corpus.dataset (
    id                  bigserial primary key,
    workspace_id        bigint not null references app.workspace(id),
    dataset_key         varchar(100) not null,
    name                varchar(255) not null,
    source_type         varchar(50) not null,
    status              varchar(50) not null default 'READY',
    pii_redaction_status varchar(50) not null default 'PENDING',
    meta_json           jsonb not null default '{}'::jsonb,
    created_by          bigint references app.app_user(id),
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (workspace_id, dataset_key)
);

create table corpus.conversation (
    id                  bigserial primary key,
    dataset_id          bigint not null references corpus.dataset(id),
    external_case_id    varchar(255),
    channel             varchar(50),
    language_code       varchar(20) not null default 'ko',
    started_at          timestamptz,
    ended_at            timestamptz,
    turn_count          integer not null default 0,
    customer_text       text,
    full_text           text,
    meta_json           jsonb not null default '{}'::jsonb,
    created_at          timestamptz not null default now()
);

create table corpus.conversation_turn (
    id                  bigserial primary key,
    conversation_id     bigint not null references corpus.conversation(id) on delete cascade,
    turn_index          integer not null,
    speaker_role        varchar(50) not null,
    message_text        text not null,
    redacted_text       text,
    event_time          timestamptz,
    meta_json           jsonb not null default '{}'::jsonb,
    created_at          timestamptz not null default now(),
    unique (conversation_id, turn_index)
);

create table corpus.conversation_feature_snapshot (
    id                  bigserial primary key,
    conversation_id     bigint not null references corpus.conversation(id) on delete cascade,
    feature_type        varchar(100) not null,
    feature_version     varchar(100) not null,
    payload_json        jsonb not null default '{}'::jsonb,
    artifact_uri        text,
    created_at          timestamptz not null default now()
);
```

### 7.4 pack

```sql
create table pack.domain_pack (
    id                  bigserial primary key,
    workspace_id        bigint not null references app.workspace(id),
    pack_key            varchar(100) not null,
    name                varchar(255) not null,
    description         text,
    status              varchar(50) not null default 'ACTIVE',
    created_by          bigint references app.app_user(id),
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (workspace_id, pack_key)
);

create table pack.domain_pack_version (
    id                  bigserial primary key,
    domain_pack_id      bigint not null references pack.domain_pack(id) on delete cascade,
    version_no          integer not null,
    lifecycle_status    varchar(50) not null default 'DRAFT',
    source_pipeline_job_id bigint references pipeline.pipeline_job(id),
    summary_json        jsonb not null default '{}'::jsonb,
    published_at        timestamptz,
    created_by          bigint references app.app_user(id),
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (domain_pack_id, version_no)
);

create table pack.intent_definition (
    id                  bigserial primary key,
    domain_pack_version_id bigint not null references pack.domain_pack_version(id) on delete cascade,
    intent_code         varchar(100) not null,
    name                varchar(255) not null,
    description         text,
    taxonomy_level      integer not null default 1,
    parent_intent_id    bigint references pack.intent_definition(id),
    status              varchar(50) not null default 'ACTIVE',
    source_cluster_ref  jsonb not null default '{}'::jsonb,
    entry_condition_json jsonb not null default '{}'::jsonb,
    evidence_json       jsonb not null default '[]'::jsonb,
    meta_json           jsonb not null default '{}'::jsonb,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (domain_pack_version_id, intent_code)
);

create table pack.slot_definition (
    id                  bigserial primary key,
    domain_pack_version_id bigint not null references pack.domain_pack_version(id) on delete cascade,
    slot_code           varchar(100) not null,
    name                varchar(255) not null,
    description         text,
    data_type           varchar(50) not null,
    is_sensitive        boolean not null default false,
    validation_rule_json jsonb not null default '{}'::jsonb,
    default_value_json  jsonb,
    meta_json           jsonb not null default '{}'::jsonb,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (domain_pack_version_id, slot_code)
);

create table pack.intent_slot_binding (
    id                  bigserial primary key,
    intent_definition_id bigint not null references pack.intent_definition(id) on delete cascade,
    slot_definition_id  bigint not null references pack.slot_definition(id) on delete cascade,
    is_required         boolean not null default false,
    collection_order    integer,
    prompt_hint         text,
    condition_json      jsonb not null default '{}'::jsonb,
    unique (intent_definition_id, slot_definition_id)
);

create table pack.policy_definition (
    id                  bigserial primary key,
    domain_pack_version_id bigint not null references pack.domain_pack_version(id) on delete cascade,
    policy_code         varchar(100) not null,
    name                varchar(255) not null,
    description         text,
    severity            varchar(50),
    condition_json      jsonb not null default '{}'::jsonb,
    action_json         jsonb not null default '{}'::jsonb,
    evidence_json       jsonb not null default '[]'::jsonb,
    meta_json           jsonb not null default '{}'::jsonb,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (domain_pack_version_id, policy_code)
);

create table pack.risk_definition (
    id                  bigserial primary key,
    domain_pack_version_id bigint not null references pack.domain_pack_version(id) on delete cascade,
    risk_code           varchar(100) not null,
    name                varchar(255) not null,
    description         text,
    risk_level          varchar(50) not null,
    trigger_condition_json jsonb not null default '{}'::jsonb,
    handling_action_json jsonb not null default '{}'::jsonb,
    evidence_json       jsonb not null default '[]'::jsonb,
    meta_json           jsonb not null default '{}'::jsonb,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (domain_pack_version_id, risk_code)
);

create table pack.workflow_definition (
    id                  bigserial primary key,
    domain_pack_version_id bigint not null references pack.domain_pack_version(id) on delete cascade,
    workflow_code       varchar(100) not null,
    name                varchar(255) not null,
    description         text,
    graph_json          jsonb not null,
    initial_state       varchar(100),
    terminal_states_json jsonb not null default '[]'::jsonb,
    evidence_json       jsonb not null default '[]'::jsonb,
    meta_json           jsonb not null default '{}'::jsonb,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (domain_pack_version_id, workflow_code)
);

create table pack.intent_workflow_binding (
    id                  bigserial primary key,
    intent_definition_id bigint not null references pack.intent_definition(id) on delete cascade,
    workflow_definition_id bigint not null references pack.workflow_definition(id) on delete cascade,
    is_primary          boolean not null default true,
    route_condition_json jsonb not null default '{}'::jsonb,
    unique (intent_definition_id, workflow_definition_id)
);
```

### 7.5 review

```sql
create table review.review_session (
    id                  bigserial primary key,
    workspace_id        bigint not null references app.workspace(id),
    domain_pack_version_id bigint not null references pack.domain_pack_version(id),
    status              varchar(50) not null default 'OPEN',
    title               varchar(255) not null,
    description         text,
    assigned_reviewer_id bigint references app.app_user(id),
    created_by          bigint references app.app_user(id),
    opened_at           timestamptz not null default now(),
    closed_at           timestamptz,
    meta_json           jsonb not null default '{}'::jsonb
);

create table review.review_task (
    id                  bigserial primary key,
    review_session_id   bigint not null references review.review_session(id) on delete cascade,
    target_type         varchar(50) not null,
    target_id           bigint,
    target_ref_json     jsonb not null default '{}'::jsonb,
    title               varchar(255) not null,
    status              varchar(50) not null default 'OPEN',
    priority            varchar(50) not null default 'NORMAL',
    proposed_change_json jsonb not null default '{}'::jsonb,
    resolved_by         bigint references app.app_user(id),
    resolved_at         timestamptz,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create table review.review_comment (
    id                  bigserial primary key,
    review_task_id      bigint not null references review.review_task(id) on delete cascade,
    author_id           bigint not null references app.app_user(id),
    body                text not null,
    payload_json        jsonb not null default '{}'::jsonb,
    created_at          timestamptz not null default now()
);

create table review.review_decision (
    id                  bigserial primary key,
    review_session_id   bigint not null references review.review_session(id) on delete cascade,
    target_type         varchar(50) not null,
    target_id           bigint,
    decision_type       varchar(50) not null,
    reason              text,
    decided_by          bigint not null references app.app_user(id),
    decision_payload_json jsonb not null default '{}'::jsonb,
    decided_at          timestamptz not null default now()
);

create table review.review_activity_log (
    id                  bigserial primary key,
    review_session_id   bigint not null references review.review_session(id) on delete cascade,
    review_task_id      bigint references review.review_task(id) on delete set null,
    actor_id            bigint not null references app.app_user(id),
    activity_type       varchar(100) not null,
    target_type         varchar(50),
    target_id           bigint,
    duration_ms         bigint,
    payload_json        jsonb not null default '{}'::jsonb,
    created_at          timestamptz not null default now()
);

create table review.review_summary_metric (
    id                  bigserial primary key,
    review_session_id   bigint not null references review.review_session(id) on delete cascade,
    metric_name         varchar(100) not null,
    metric_value_numeric double precision,
    metric_payload_json jsonb not null default '{}'::jsonb,
    created_at          timestamptz not null default now(),
    unique (review_session_id, metric_name)
);
```

### 7.6 pipeline

```sql
create table pipeline.pipeline_job (
    id                  bigserial primary key,
    version             bigint not null default 0,
    workspace_id        bigint not null references app.workspace(id),
    dataset_id          bigint references corpus.dataset(id),
    domain_pack_id      bigint references pack.domain_pack(id),
    job_type            varchar(100) not null,
    status              varchar(50) not null default 'QUEUED',
    trigger_source      varchar(50) not null default 'MANUAL',
    airflow_dag_id      varchar(255),
    airflow_run_id      varchar(255),
    request_payload_json jsonb not null default '{}'::jsonb,
    result_summary_json jsonb not null default '{}'::jsonb,
    triggered_by        bigint references app.app_user(id),
    requested_at        timestamptz not null default now(),
    started_at          timestamptz,
    finished_at         timestamptz,
    last_error_message  text,
    unique (airflow_dag_id, airflow_run_id)
);

create table pipeline.pipeline_job_event (
    id                  bigserial primary key,
    pipeline_job_id     bigint not null references pipeline.pipeline_job(id) on delete cascade,
    event_type          varchar(100) not null,
    stage_name          varchar(100),
    payload_json        jsonb not null default '{}'::jsonb,
    created_at          timestamptz not null default now()
);

create table pipeline.pipeline_artifact (
    id                  bigserial primary key,
    pipeline_job_id     bigint not null references pipeline.pipeline_job(id) on delete cascade,
    stage_name          varchar(100) not null,
    artifact_type       varchar(100) not null,
    artifact_uri        text,
    content_hash        varchar(128),
    payload_json        jsonb not null default '{}'::jsonb,
    created_at          timestamptz not null default now()
);

create table pipeline.webhook_receipt (
    id                  bigserial primary key,
    pipeline_job_id     bigint references pipeline.pipeline_job(id),
    external_event_id   varchar(255),
    webhook_type        varchar(100) not null,
    request_headers_json jsonb not null default '{}'::jsonb,
    request_body_json   jsonb not null default '{}'::jsonb,
    processing_status   varchar(50) not null default 'RECEIVED',
    received_at         timestamptz not null default now(),
    processed_at        timestamptz,
    unique (external_event_id)
);

create table pipeline.evaluation_run (
    id                      bigserial primary key,
    pipeline_job_id         bigint not null references pipeline.pipeline_job(id) on delete cascade,
    evaluation_type         varchar(50) not null,
    dataset_split           varchar(50) not null,
    config_snapshot_json    jsonb not null default '{}'::jsonb,
    started_at              timestamptz not null default now(),
    finished_at             timestamptz
);

create table pipeline.evaluation_metric (
    id                      bigserial primary key,
    evaluation_run_id       bigint not null references pipeline.evaluation_run(id) on delete cascade,
    metric_name             varchar(100) not null,
    metric_scope            varchar(50) not null default 'GLOBAL',
    metric_target_ref       varchar(255),
    metric_value_numeric    double precision,
    metric_value_text       text,
    metric_payload_json     jsonb not null default '{}'::jsonb,
    created_at              timestamptz not null default now()
);

create table pipeline.cluster_evaluation (
    id                          bigserial primary key,
    evaluation_run_id           bigint not null references pipeline.evaluation_run(id) on delete cascade,
    cluster_ref                 varchar(255) not null,
    interpretability_score      double precision,
    workflow_consistency_score  double precision,
    branching_explainability_score double precision,
    merge_candidate             boolean not null default false,
    split_candidate             boolean not null default false,
    notes                       text,
    payload_json                jsonb not null default '{}'::jsonb,
    created_at                  timestamptz not null default now()
);

create table pipeline.novel_intent_candidate (
    id                      bigserial primary key,
    evaluation_run_id       bigint not null references pipeline.evaluation_run(id) on delete cascade,
    candidate_key           varchar(100) not null,
    source_type             varchar(50) not null,
    candidate_size          integer not null default 0,
    suggested_name          varchar(255),
    payload_json            jsonb not null default '{}'::jsonb,
    review_required         boolean not null default true,
    created_at              timestamptz not null default now(),
    unique (evaluation_run_id, candidate_key)
);

create table pipeline.taxonomy_drift_log (
    id                      bigserial primary key,
    domain_pack_id          bigint not null references pack.domain_pack(id) on delete cascade,
    from_version_id         bigint references pack.domain_pack_version(id),
    to_version_id           bigint references pack.domain_pack_version(id),
    new_intent_count        integer not null default 0,
    merged_intent_count     integer not null default 0,
    split_intent_count      integer not null default 0,
    retired_intent_count    integer not null default 0,
    payload_json            jsonb not null default '{}'::jsonb,
    created_at              timestamptz not null default now()
);
```

### 7.7 runtime

```sql
create table runtime.chat_session (
    id                  bigserial primary key,
    workspace_id        bigint not null references app.workspace(id),
    domain_pack_version_id bigint not null references pack.domain_pack_version(id),
    status              varchar(50) not null default 'OPEN',
    channel             varchar(50) not null default 'DEMO_WEB',
    started_by          bigint references app.app_user(id),
    meta_json           jsonb not null default '{}'::jsonb,
    started_at          timestamptz not null default now(),
    ended_at            timestamptz
);

create table runtime.chat_message (
    id                  bigserial primary key,
    chat_session_id     bigint not null references runtime.chat_session(id) on delete cascade,
    seq_no              integer not null,
    sender_role         varchar(50) not null,
    message_type        varchar(50) not null default 'TEXT',
    content             text,
    payload_json        jsonb not null default '{}'::jsonb,
    created_at          timestamptz not null default now(),
    unique (chat_session_id, seq_no)
);

create table runtime.workflow_execution (
    id                  bigserial primary key,
    chat_session_id     bigint not null references runtime.chat_session(id) on delete cascade,
    workflow_definition_id bigint references pack.workflow_definition(id),
    intent_definition_id bigint references pack.intent_definition(id),
    status              varchar(50) not null default 'RUNNING',
    current_state       varchar(100),
    slot_values_json    jsonb not null default '{}'::jsonb,
    policy_snapshot_json jsonb not null default '{}'::jsonb,
    risk_snapshot_json  jsonb not null default '{}'::jsonb,
    started_at          timestamptz not null default now(),
    finished_at         timestamptz
);

create table runtime.workflow_execution_step (
    id                  bigserial primary key,
    workflow_execution_id bigint not null references runtime.workflow_execution(id) on delete cascade,
    seq_no              integer not null,
    state_from          varchar(100),
    state_to            varchar(100),
    action_type         varchar(100) not null,
    reason_text         text,
    evidence_json       jsonb not null default '[]'::jsonb,
    created_at          timestamptz not null default now(),
    unique (workflow_execution_id, seq_no)
);

create table runtime.decision_log (
    id                      bigserial primary key,
    workflow_execution_id   bigint not null references runtime.workflow_execution(id) on delete cascade,
    step_seq_no             integer not null,
    decision_type           varchar(100) not null,
    intent_definition_id    bigint references pack.intent_definition(id),
    state_name              varchar(100),
    confidence_score        double precision,
    selected_action         varchar(100),
    missing_slots_json      jsonb not null default '[]'::jsonb,
    policy_hits_json        jsonb not null default '[]'::jsonb,
    risk_hits_json          jsonb not null default '[]'::jsonb,
    evidence_json           jsonb not null default '[]'::jsonb,
    payload_json            jsonb not null default '{}'::jsonb,
    created_at              timestamptz not null default now(),
    unique (workflow_execution_id, step_seq_no, decision_type)
);

create table runtime.session_outcome (
    id                      bigserial primary key,
    chat_session_id         bigint not null references runtime.chat_session(id) on delete cascade,
    workflow_execution_id   bigint references runtime.workflow_execution(id) on delete set null,
    outcome_type            varchar(50) not null,
    handoff_reason          varchar(100),
    satisfaction_score      integer,
    reopen_within_hours     integer,
    payload_json            jsonb not null default '{}'::jsonb,
    created_at              timestamptz not null default now(),
    unique (chat_session_id)
);
```

---

## 8. 추천 인덱스

```sql
create index idx_conversation_dataset_id
    on corpus.conversation(dataset_id);

create index idx_conversation_turn_conversation_id
    on corpus.conversation_turn(conversation_id, turn_index);

create index idx_pack_version_pack_id
    on pack.domain_pack_version(domain_pack_id, version_no desc);

create index idx_intent_version_id
    on pack.intent_definition(domain_pack_version_id);

create index idx_slot_version_id
    on pack.slot_definition(domain_pack_version_id);

create index idx_policy_version_id
    on pack.policy_definition(domain_pack_version_id);

create index idx_risk_version_id
    on pack.risk_definition(domain_pack_version_id);

create index idx_workflow_version_id
    on pack.workflow_definition(domain_pack_version_id);

create index idx_review_session_pack_version
    on review.review_session(domain_pack_version_id);

create index idx_review_task_session_status
    on review.review_task(review_session_id, status);

create index idx_pipeline_job_workspace_status
    on pipeline.pipeline_job(workspace_id, status, requested_at desc);

create index idx_pipeline_artifact_job_stage
    on pipeline.pipeline_artifact(pipeline_job_id, stage_name);

create index idx_chat_session_workspace_started_at
    on runtime.chat_session(workspace_id, started_at desc);

create index idx_workflow_execution_session
    on runtime.workflow_execution(chat_session_id);

create index idx_workflow_graph_json
    on pack.workflow_definition using gin (graph_json);

create index idx_pipeline_artifact_payload_json
    on pipeline.pipeline_artifact using gin (payload_json);

create index idx_evaluation_metric_run_name
    on pipeline.evaluation_metric(evaluation_run_id, metric_name);

create index idx_cluster_evaluation_run_cluster
    on pipeline.cluster_evaluation(evaluation_run_id, cluster_ref);

create index idx_review_activity_session_type
    on review.review_activity_log(review_session_id, activity_type, created_at desc);

create index idx_decision_log_execution_seq
    on runtime.decision_log(workflow_execution_id, step_seq_no);

create index idx_novel_intent_eval_run
    on pipeline.novel_intent_candidate(evaluation_run_id);

create index idx_taxonomy_drift_pack
    on pipeline.taxonomy_drift_log(domain_pack_id, created_at desc);
```

---

## 9. ER 관점 핵심 관계

### 9.1 도메인 팩 계층
- `workspace 1:N domain_pack`
- `domain_pack 1:N domain_pack_version`
- `domain_pack_version 1:N intent_definition`
- `domain_pack_version 1:N slot_definition`
- `domain_pack_version 1:N policy_definition`
- `domain_pack_version 1:N risk_definition`
- `domain_pack_version 1:N workflow_definition`

### 9.2 검토 계층
- `domain_pack_version 1:N review_session`
- `review_session 1:N review_task`
- `review_task 1:N review_comment`
- `review_session 1:N review_decision`

### 9.3 파이프라인 계층
- `workspace 1:N pipeline_job`
- `dataset 1:N pipeline_job`
- `pipeline_job 1:N pipeline_job_event`
- `pipeline_job 1:N pipeline_artifact`
- `pipeline_job 1:N evaluation_run`
- `evaluation_run 1:N evaluation_metric`
- `evaluation_run 1:N cluster_evaluation`
- `evaluation_run 1:N novel_intent_candidate`

### 9.4 런타임 계층
- `workspace 1:N chat_session`
- `chat_session 1:N chat_message`
- `chat_session 1:1 workflow_execution`
- `workflow_execution 1:N workflow_execution_step`
- `workflow_execution 1:N decision_log`
- `chat_session 1:1 session_outcome`

---

## 10. JSONB로 둔 필드와 이유

### 10.1 반드시 JSONB로 두는 것이 좋은 것
- `workflow_definition.graph_json`
- `pipeline_artifact.payload_json`
- `conversation_feature_snapshot.payload_json`
- `evaluation_metric.metric_payload_json`
- `decision_log.evidence_json`
- `workflow_execution.slot_values_json`

### 10.2 이유
- workflow graph 구조는 초기 단계에서 자주 바뀔 가능성이 높다.
- intent discovery 산출물은 실험이 계속 바뀌므로 고정 스키마보다 JSONB가 유리하다.
- evidence, policy hit, risk hit, cluster metadata는 정형화 수준이 낮아 유연 저장이 필요하다.

---

## 11. 상태값 예시

### 11.1 `domain_pack_version.lifecycle_status`
- `DRAFT`
- `IN_REVIEW`
- `APPROVED`
- `PUBLISHED`
- `ARCHIVED`

### 11.2 `review.review_session.status`
- `OPEN`
- `IN_PROGRESS`
- `COMPLETED`
- `CLOSED`

### 11.3 `pipeline.pipeline_job.status`
- `QUEUED`
- `RUNNING`
- `FAILED`
- `SUCCEEDED`
- `CANCELLED`

### 11.4 `runtime.workflow_execution.status`
- `RUNNING`
- `WAITING_INPUT`
- `COMPLETED`
- `HANDED_OFF`
- `BLOCKED`
- `FAILED`

### 11.5 `runtime.session_outcome.outcome_type`
- `RESOLVED`
- `HANDED_OFF`
- `BLOCKED`
- `ABANDONED`
- `UNRESOLVED`

---

## 12. 이 스키마에서 특히 중요한 결정

### 12.1 Domain Pack Version을 중심으로 관리
개별 intent나 workflow를 따로 versioning하지 않고, pack version 아래에 함께 묶는다.
이렇게 해야 review, publish, rollback, runtime 적용 경계가 명확해진다.

### 12.2 Workflow는 JSONB를 source of truth로 둔다
초기에는 node/edge를 별도 정규화 테이블로 쪼개지 않는다.
나중에 분석성 쿼리 요구가 커질 때 `workflow_node`, `workflow_edge` 파생 테이블을 추가한다.

### 12.3 Review는 부속 기능이 아니라 독립 영역으로 본다
이 프로젝트는 사람이 AI 초안을 검토·수정·승인하는 구조이므로, review task/decision/activity를 별도 데이터 모델로 유지하는 편이 맞다.

### 12.4 Metrics / Logs는 운영 데이터와 분리한다
pipeline 평가, review 비용, runtime decision 근거는 나중에 품질 개선과 발표 지표에 직접 연결된다.
따라서 처음부터 별도 테이블로 두는 편이 좋다.

---

## 13. 구현 우선순위

### 13.1 1차 필수 테이블
아래 10개는 가장 먼저 구현해도 좋다.

- `app.workspace`
- `app.app_user`
- `pack.domain_pack`
- `pack.domain_pack_version`
- `pack.intent_definition`
- `pack.slot_definition`
- `pack.workflow_definition`
- `review.review_session`
- `review.review_task`
- `pipeline.pipeline_job`

### 13.2 2차 권장 테이블

- `pack.policy_definition`
- `pack.risk_definition`
- `pipeline.pipeline_artifact`
- `pipeline.evaluation_run`
- `pipeline.evaluation_metric`
- `runtime.chat_session`
- `runtime.workflow_execution`
- `runtime.decision_log`

### 13.3 3차 확장 테이블

- `pipeline.cluster_evaluation`
- `pipeline.novel_intent_candidate`
- `pipeline.taxonomy_drift_log`
- `review.review_activity_log`
- `review.review_summary_metric`
- `runtime.session_outcome`

---

## 14. 다음 단계 제안

이 문서를 기준으로 다음 단계에서 정리하면 좋은 항목은 아래와 같다.

- JPA Entity / Aggregate 매핑 초안
- Liquibase migration 파일 분리 전략
- domain pack version publish 플로우의 상태 전이 정의
- Airflow artifact payload schema 정리
- workflow graph JSON schema 정의
- review 대상 변경(diff) 표현 방식 정의
- runtime decision log를 화면에 어떻게 노출할지 정의

---

## 15. 최종 요약

현재 PostgreSQL 스키마는 크게 아래 구조로 이해하면 된다.

- **corpus**: 상담 로그 원천과 전처리 결과 저장
- **pack**: intent / slot / policy / risk / workflow를 포함한 domain pack 저장
- **review**: AI 초안에 대한 사람 검토 및 승인 기록 저장
- **pipeline**: Airflow job, artifact, evaluation, drift 정보 저장
- **runtime**: 데모 채팅, workflow 실행 상태, decision log 저장
- **app**: workspace 및 사용자 관리

즉, 이 스키마는 단순 채팅 로그 저장소가 아니라,
**상담 로그를 domain pack으로 변환하고, 이를 검토·배포·실행·평가하는 전체 운영 워크스페이스의 데이터 모델**이다.
