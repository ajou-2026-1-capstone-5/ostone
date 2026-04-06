--liquibase formatted sql

--changeset init:20250403-create-app-schema
--comment: Create app schema for workspace and user management
create schema if not exists app;

--changeset init:20250403-create-app-workspace-table
--comment: Create workspace table
create table app.workspace (
    id bigserial primary key,
    workspace_key varchar(100) not null unique,
    name varchar(255) not null,
    description text,
    status varchar(50) not null default 'ACTIVE',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

--changeset init:20250403-create-app-user-table
--comment: Create app_user table
create table app.app_user (
    id bigserial primary key,
    email varchar(255) not null unique,
    name varchar(255) not null,
    role varchar(50) not null default 'OPERATOR',
    status varchar(50) not null default 'ACTIVE',
    profile_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

--changeset init:20250403-create-workspace-member-table
--comment: Create workspace_member table
create table app.workspace_member (
    id bigserial primary key,
    workspace_id bigint not null references app.workspace(id),
    user_id bigint not null references app.app_user(id),
    member_role varchar(50) not null,
    joined_at timestamptz not null default now(),
    unique (workspace_id, user_id)
);

--changeset init:20250403-create-corpus-schema
--comment: Create corpus schema for conversation data
create schema if not exists corpus;

--changeset init:20250403-create-corpus-dataset-table
--comment: Create dataset table
create table corpus.dataset (
    id bigserial primary key,
    workspace_id bigint not null references app.workspace(id),
    dataset_key varchar(100) not null,
    name varchar(255) not null,
    source_type varchar(50) not null,
    status varchar(50) not null default 'READY',
    pii_redaction_status varchar(50) not null default 'PENDING',
    meta_json jsonb not null default '{}'::jsonb,
    created_by bigint references app.app_user(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (workspace_id, dataset_key)
);

--changeset init:20250403-create-corpus-conversation-table
--comment: Create conversation table
create table corpus.conversation (
    id bigserial primary key,
    dataset_id bigint not null references corpus.dataset(id),
    external_case_id varchar(255),
    channel varchar(50),
    language_code varchar(20) not null default 'ko',
    started_at timestamptz,
    ended_at timestamptz,
    turn_count integer not null default 0,
    customer_text text,
    full_text text,
    meta_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

--changeset init:20250403-create-corpus-conversation-turn-table
--comment: Create conversation_turn table
create table corpus.conversation_turn (
    id bigserial primary key,
    conversation_id bigint not null references corpus.conversation(id) on delete cascade,
    turn_index integer not null,
    speaker_role varchar(50) not null,
    message_text text not null,
    redacted_text text,
    event_time timestamptz,
    meta_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique (conversation_id, turn_index)
);

--changeset init:20250403-create-corpus-conversation-feature-snapshot-table
--comment: Create conversation_feature_snapshot table
create table corpus.conversation_feature_snapshot (
    id bigserial primary key,
    conversation_id bigint not null references corpus.conversation(id) on delete cascade,
    feature_type varchar(100) not null,
    feature_version varchar(100) not null,
    payload_json jsonb not null default '{}'::jsonb,
    artifact_uri text,
    created_at timestamptz not null default now()
);

--changeset init:20250403-create-pack-schema
--comment: Create pack schema for domain pack data
create schema if not exists pack;

--changeset init:20250403-create-pack-domain-pack-table
--comment: Create domain_pack table
create table pack.domain_pack (
    id bigserial primary key,
    workspace_id bigint not null references app.workspace(id),
    pack_key varchar(100) not null,
    name varchar(255) not null,
    description text,
    status varchar(50) not null default 'ACTIVE',
    created_by bigint references app.app_user(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (workspace_id, pack_key)
);

--changeset init:20250403-create-pack-domain-pack-version-table
--comment: Create domain_pack_version table
create table pack.domain_pack_version (
    id bigserial primary key,
    domain_pack_id bigint not null references pack.domain_pack(id) on delete cascade,
    version_no integer not null,
    lifecycle_status varchar(50) not null default 'DRAFT',
    source_pipeline_job_id bigint,
    summary_json jsonb not null default '{}'::jsonb,
    published_at timestamptz,
    created_by bigint references app.app_user(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (domain_pack_id, version_no)
);

--changeset init:20250403-create-pack-intent-definition-table
--comment: Create intent_definition table
create table pack.intent_definition (
    id bigserial primary key,
    domain_pack_version_id bigint not null references pack.domain_pack_version(id) on delete cascade,
    intent_code varchar(100) not null,
    name varchar(255) not null,
    description text,
    taxonomy_level integer not null default 1,
    parent_intent_id bigint references pack.intent_definition(id),
    status varchar(50) not null default 'ACTIVE',
    source_cluster_ref jsonb not null default '{}'::jsonb,
    entry_condition_json jsonb not null default '{}'::jsonb,
    evidence_json jsonb not null default '[]'::jsonb,
    meta_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (domain_pack_version_id, intent_code)
);

--changeset init:20250403-create-pack-slot-definition-table
--comment: Create slot_definition table
create table pack.slot_definition (
    id bigserial primary key,
    domain_pack_version_id bigint not null references pack.domain_pack_version(id) on delete cascade,
    slot_code varchar(100) not null,
    name varchar(255) not null,
    description text,
    data_type varchar(50) not null,
    is_sensitive boolean not null default false,
    validation_rule_json jsonb not null default '{}'::jsonb,
    default_value_json jsonb,
    meta_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (domain_pack_version_id, slot_code)
);

--changeset init:20250403-create-pack-intent-slot-binding-table
--comment: Create intent_slot_binding table
create table pack.intent_slot_binding (
    id bigserial primary key,
    intent_definition_id bigint not null references pack.intent_definition(id) on delete cascade,
    slot_definition_id bigint not null references pack.slot_definition(id) on delete cascade,
    is_required boolean not null default false,
    collection_order integer,
    prompt_hint text,
    condition_json jsonb not null default '{}'::jsonb,
    unique (intent_definition_id, slot_definition_id)
);

--changeset init:20250403-create-pack-policy-definition-table
--comment: Create policy_definition table
create table pack.policy_definition (
    id bigserial primary key,
    domain_pack_version_id bigint not null references pack.domain_pack_version(id) on delete cascade,
    policy_code varchar(100) not null,
    name varchar(255) not null,
    description text,
    severity varchar(50),
    condition_json jsonb not null default '{}'::jsonb,
    action_json jsonb not null default '{}'::jsonb,
    evidence_json jsonb not null default '[]'::jsonb,
    meta_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (domain_pack_version_id, policy_code)
);

--changeset init:20250403-create-pack-risk-definition-table
--comment: Create risk_definition table
create table pack.risk_definition (
    id bigserial primary key,
    domain_pack_version_id bigint not null references pack.domain_pack_version(id) on delete cascade,
    risk_code varchar(100) not null,
    name varchar(255) not null,
    description text,
    risk_level varchar(50) not null,
    trigger_condition_json jsonb not null default '{}'::jsonb,
    handling_action_json jsonb not null default '{}'::jsonb,
    evidence_json jsonb not null default '[]'::jsonb,
    meta_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (domain_pack_version_id, risk_code)
);

--changeset init:20250403-create-pack-workflow-definition-table
--comment: Create workflow_definition table
create table pack.workflow_definition (
    id bigserial primary key,
    domain_pack_version_id bigint not null references pack.domain_pack_version(id) on delete cascade,
    workflow_code varchar(100) not null,
    name varchar(255) not null,
    description text,
    graph_json jsonb not null,
    initial_state varchar(100),
    terminal_states_json jsonb not null default '[]'::jsonb,
    evidence_json jsonb not null default '[]'::jsonb,
    meta_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (domain_pack_version_id, workflow_code)
);

--changeset init:20250403-create-pack-intent-workflow-binding-table
--comment: Create intent_workflow_binding table
create table pack.intent_workflow_binding (
    id bigserial primary key,
    intent_definition_id bigint not null references pack.intent_definition(id) on delete cascade,
    workflow_definition_id bigint not null references pack.workflow_definition(id) on delete cascade,
    is_primary boolean not null default true,
    route_condition_json jsonb not null default '{}'::jsonb,
    unique (intent_definition_id, workflow_definition_id)
);

--changeset init:20250403-create-review-schema
--comment: Create review schema for review workflow
create schema if not exists review;

--changeset init:20250403-create-review-session-table
--comment: Create review_session table
create table review.review_session (
    id bigserial primary key,
    workspace_id bigint not null references app.workspace(id),
    domain_pack_version_id bigint not null references pack.domain_pack_version(id),
    status varchar(50) not null default 'OPEN',
    title varchar(255) not null,
    description text,
    assigned_reviewer_id bigint references app.app_user(id),
    created_by bigint references app.app_user(id),
    opened_at timestamptz not null default now(),
    closed_at timestamptz,
    meta_json jsonb not null default '{}'::jsonb
);

--changeset init:20250403-create-review-task-table
--comment: Create review_task table
create table review.review_task (
    id bigserial primary key,
    review_session_id bigint not null references review.review_session(id) on delete cascade,
    target_type varchar(50) not null,
    target_id bigint,
    target_ref_json jsonb not null default '{}'::jsonb,
    title varchar(255) not null,
    status varchar(50) not null default 'OPEN',
    priority varchar(50) not null default 'NORMAL',
    proposed_change_json jsonb not null default '{}'::jsonb,
    resolved_by bigint references app.app_user(id),
    resolved_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

--changeset init:20250403-create-review-comment-table
--comment: Create review_comment table
create table review.review_comment (
    id bigserial primary key,
    review_task_id bigint not null references review.review_task(id) on delete cascade,
    author_id bigint not null references app.app_user(id),
    body text not null,
    payload_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

--changeset init:20250403-create-review-decision-table
--comment: Create review_decision table
create table review.review_decision (
    id bigserial primary key,
    review_session_id bigint not null references review.review_session(id) on delete cascade,
    target_type varchar(50) not null,
    target_id bigint,
    decision_type varchar(50) not null,
    reason text,
    decided_by bigint not null references app.app_user(id),
    decision_payload_json jsonb not null default '{}'::jsonb,
    decided_at timestamptz not null default now()
);

--changeset init:20250403-create-review-activity-log-table
--comment: Create review_activity_log table
create table review.review_activity_log (
    id bigserial primary key,
    review_session_id bigint not null references review.review_session(id) on delete cascade,
    review_task_id bigint references review.review_task(id) on delete set null,
    actor_id bigint not null references app.app_user(id),
    activity_type varchar(100) not null,
    target_type varchar(50),
    target_id bigint,
    duration_ms bigint,
    payload_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

--changeset init:20250403-create-review-summary-metric-table
--comment: Create review_summary_metric table
create table review.review_summary_metric (
    id bigserial primary key,
    review_session_id bigint not null references review.review_session(id) on delete cascade,
    metric_name varchar(100) not null,
    metric_value_numeric double precision,
    metric_payload_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique (review_session_id, metric_name)
);

--changeset init:20250403-create-pipeline-schema
--comment: Create pipeline schema for pipeline jobs
create schema if not exists pipeline;

--changeset init:20250403-create-pipeline-job-table
--comment: Create pipeline_job table
create table pipeline.pipeline_job (
    id bigserial primary key,
    workspace_id bigint not null references app.workspace(id),
    dataset_id bigint references corpus.dataset(id),
    domain_pack_id bigint references pack.domain_pack(id),
    job_type varchar(100) not null,
    status varchar(50) not null default 'QUEUED',
    trigger_source varchar(50) not null default 'MANUAL',
    airflow_dag_id varchar(255),
    airflow_run_id varchar(255),
    request_payload_json jsonb not null default '{}'::jsonb,
    result_summary_json jsonb not null default '{}'::jsonb,
    triggered_by bigint references app.app_user(id),
    requested_at timestamptz not null default now(),
    started_at timestamptz,
    finished_at timestamptz,
    last_error_message text,
    unique (airflow_dag_id, airflow_run_id)
);

--changeset init:20250403-create-pipeline-job-event-table
--comment: Create pipeline_job_event table
create table pipeline.pipeline_job_event (
    id bigserial primary key,
    pipeline_job_id bigint not null references pipeline.pipeline_job(id) on delete cascade,
    event_type varchar(100) not null,
    stage_name varchar(100),
    payload_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

--changeset init:20250403-create-pipeline-artifact-table
--comment: Create pipeline_artifact table
create table pipeline.pipeline_artifact (
    id bigserial primary key,
    pipeline_job_id bigint not null references pipeline.pipeline_job(id) on delete cascade,
    stage_name varchar(100) not null,
    artifact_type varchar(100) not null,
    artifact_uri text,
    content_hash varchar(128),
    payload_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

--changeset init:20250403-create-pipeline-webhook-receipt-table
--comment: Create webhook_receipt table
create table pipeline.webhook_receipt (
    id bigserial primary key,
    pipeline_job_id bigint references pipeline.pipeline_job(id),
    external_event_id varchar(255),
    webhook_type varchar(100) not null,
    request_headers_json jsonb not null default '{}'::jsonb,
    request_body_json jsonb not null default '{}'::jsonb,
    processing_status varchar(50) not null default 'RECEIVED',
    received_at timestamptz not null default now(),
    processed_at timestamptz,
    unique (external_event_id)
);

--changeset init:20250403-create-pipeline-evaluation-run-table
--comment: Create evaluation_run table
create table pipeline.evaluation_run (
    id bigserial primary key,
    pipeline_job_id bigint not null references pipeline.pipeline_job(id) on delete cascade,
    evaluation_type varchar(50) not null,
    dataset_split varchar(50) not null,
    config_snapshot_json jsonb not null default '{}'::jsonb,
    started_at timestamptz not null default now(),
    finished_at timestamptz
);

--changeset init:20250403-create-pipeline-evaluation-metric-table
--comment: Create evaluation_metric table
create table pipeline.evaluation_metric (
    id bigserial primary key,
    evaluation_run_id bigint not null references pipeline.evaluation_run(id) on delete cascade,
    metric_name varchar(100) not null,
    metric_scope varchar(50) not null default 'GLOBAL',
    metric_target_ref varchar(255),
    metric_value_numeric double precision,
    metric_value_text text,
    metric_payload_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

--changeset init:20250403-create-pipeline-cluster-evaluation-table
--comment: Create cluster_evaluation table
create table pipeline.cluster_evaluation (
    id bigserial primary key,
    evaluation_run_id bigint not null references pipeline.evaluation_run(id) on delete cascade,
    cluster_ref varchar(255) not null,
    interpretability_score double precision,
    workflow_consistency_score double precision,
    branching_explainability_score double precision,
    merge_candidate boolean not null default false,
    split_candidate boolean not null default false,
    notes text,
    payload_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

--changeset init:20250403-create-pipeline-novel-intent-candidate-table
--comment: Create novel_intent_candidate table
create table pipeline.novel_intent_candidate (
    id bigserial primary key,
    evaluation_run_id bigint not null references pipeline.evaluation_run(id) on delete cascade,
    candidate_key varchar(100) not null,
    source_type varchar(50) not null,
    candidate_size integer not null default 0,
    suggested_name varchar(255),
    payload_json jsonb not null default '{}'::jsonb,
    review_required boolean not null default true,
    created_at timestamptz not null default now(),
    unique (evaluation_run_id, candidate_key)
);

--changeset init:20250403-create-pipeline-taxonomy-drift-log-table
--comment: Create taxonomy_drift_log table
create table pipeline.taxonomy_drift_log (
    id bigserial primary key,
    domain_pack_id bigint not null references pack.domain_pack(id) on delete cascade,
    from_version_id bigint references pack.domain_pack_version(id),
    to_version_id bigint references pack.domain_pack_version(id),
    new_intent_count integer not null default 0,
    merged_intent_count integer not null default 0,
    split_intent_count integer not null default 0,
    retired_intent_count integer not null default 0,
    payload_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

--changeset init:20250403-create-runtime-schema
--comment: Create runtime schema for chat and workflow execution
create schema if not exists runtime;

--changeset init:20250403-create-runtime-chat-session-table
--comment: Create chat_session table
create table runtime.chat_session (
    id bigserial primary key,
    workspace_id bigint not null references app.workspace(id),
    domain_pack_version_id bigint not null references pack.domain_pack_version(id),
    status varchar(50) not null default 'OPEN',
    channel varchar(50) not null default 'DEMO_WEB',
    started_by bigint references app.app_user(id),
    meta_json jsonb not null default '{}'::jsonb,
    started_at timestamptz not null default now(),
    ended_at timestamptz
);

--changeset init:20250403-create-runtime-chat-message-table
--comment: Create chat_message table
create table runtime.chat_message (
    id bigserial primary key,
    chat_session_id bigint not null references runtime.chat_session(id) on delete cascade,
    seq_no integer not null,
    sender_role varchar(50) not null,
    message_type varchar(50) not null default 'TEXT',
    content text,
    payload_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique (chat_session_id, seq_no)
);

--changeset init:20250403-create-runtime-workflow-execution-table
--comment: Create workflow_execution table
create table runtime.workflow_execution (
    id bigserial primary key,
    chat_session_id bigint not null references runtime.chat_session(id) on delete cascade,
    workflow_definition_id bigint references pack.workflow_definition(id),
    intent_definition_id bigint references pack.intent_definition(id),
    status varchar(50) not null default 'RUNNING',
    current_state varchar(100),
    slot_values_json jsonb not null default '{}'::jsonb,
    policy_snapshot_json jsonb not null default '{}'::jsonb,
    risk_snapshot_json jsonb not null default '{}'::jsonb,
    started_at timestamptz not null default now(),
    finished_at timestamptz
);

--changeset init:20250403-create-runtime-workflow-execution-step-table
--comment: Create workflow_execution_step table
create table runtime.workflow_execution_step (
    id bigserial primary key,
    workflow_execution_id bigint not null references runtime.workflow_execution(id) on delete cascade,
    seq_no integer not null,
    state_from varchar(100),
    state_to varchar(100),
    action_type varchar(100) not null,
    reason_text text,
    evidence_json jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    unique (workflow_execution_id, seq_no)
);

--changeset init:20250403-create-runtime-decision-log-table
--comment: Create decision_log table
create table runtime.decision_log (
    id bigserial primary key,
    workflow_execution_id bigint not null references runtime.workflow_execution(id) on delete cascade,
    step_seq_no integer not null,
    decision_type varchar(100) not null,
    intent_definition_id bigint references pack.intent_definition(id),
    state_name varchar(100),
    confidence_score double precision,
    selected_action varchar(100),
    missing_slots_json jsonb not null default '[]'::jsonb,
    policy_hits_json jsonb not null default '[]'::jsonb,
    risk_hits_json jsonb not null default '[]'::jsonb,
    evidence_json jsonb not null default '[]'::jsonb,
    payload_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique (workflow_execution_id, step_seq_no, decision_type)
);

--changeset init:20250403-create-runtime-session-outcome-table
--comment: Create session_outcome table
create table runtime.session_outcome (
    id bigserial primary key,
    chat_session_id bigint not null references runtime.chat_session(id) on delete cascade,
    workflow_execution_id bigint references runtime.workflow_execution(id) on delete set null,
    outcome_type varchar(50) not null,
    handoff_reason varchar(100),
    satisfaction_score integer,
    reopen_within_hours integer,
    payload_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique (chat_session_id)
);

--changeset devjhan:20260406-add-password-hash-to-app-user
--comment: Add password_hash column as nullable initially (safe for non-empty tables)
alter table app.app_user add column password_hash varchar(255);

--changeset devjhan:20260406-add-password-reset-required
--comment: Add flag for users with no password set, requiring a forced reset at next login
alter table app.app_user add column password_reset_required boolean not null default false;

--changeset devjhan:20260406-backfill-password-reset-required
--comment: Flag existing users without a password_hash to require password reset at next login.
--comment: Recovery: on next login attempt the auth service auto-issues a 30-min reset token
--comment: returned in the 403 response body (resetToken field); call POST /api/v1/auth/password-reset/complete
--comment: with that token and a new password. For service/admin accounts that cannot perform an
--comment: interactive login, an operator can manually clear the flag via:
--comment:   UPDATE app.app_user SET password_reset_required = false WHERE email = '<account_email>';
--comment: Run this only after verifying the account already has a valid password_hash set.
update app.app_user set password_reset_required = true where password_hash is null;

--changeset devjhan:20260406-add-password-reset-token-to-app-user
--comment: Add password reset token columns to support the password-reset recovery flow
alter table app.app_user
    add column password_reset_token_hash varchar(255),
    add column password_reset_token_expires_at timestamptz;

--changeset devjhan:20260406-create-app-refresh-token-table
--comment: Create refresh_token table for JWT refresh token management
create table app.refresh_token (
    id bigserial primary key,
    version bigint not null default 0,
    user_id bigint not null references app.app_user(id) on delete cascade,
    token_hash varchar(255) not null unique,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    revoked_at timestamptz
);

--changeset devjhan:20260406-add-refresh-token-user-id-index
--comment: Add index for efficient user token lookups by user_id
create index idx_refresh_token_user_id on app.refresh_token(user_id);
