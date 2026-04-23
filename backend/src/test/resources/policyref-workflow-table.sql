CREATE SCHEMA IF NOT EXISTS pack;
CREATE TABLE IF NOT EXISTS pack.workflow_definition (
    id BIGSERIAL PRIMARY KEY,
    domain_pack_version_id BIGINT NOT NULL,
    workflow_code VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    graph_json JSONB NOT NULL,
    initial_state VARCHAR(255),
    terminal_states_json JSONB NOT NULL,
    evidence_json JSONB NOT NULL,
    meta_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
