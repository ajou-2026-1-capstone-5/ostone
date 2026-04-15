#!/bin/sh
set -eu

AIRFLOW_DB_USER="${AIRFLOW_DB_USER:-airflow}"
AIRFLOW_DB_PASSWORD="${AIRFLOW_DB_PASSWORD:?AIRFLOW_DB_PASSWORD is required}"
AIRFLOW_DB_NAME="${AIRFLOW_DB_NAME:-airflow}"

psql \
  -v ON_ERROR_STOP=1 \
  -v airflow_db_user="${AIRFLOW_DB_USER}" \
  -v airflow_db_password="${AIRFLOW_DB_PASSWORD}" \
  -v airflow_db_name="${AIRFLOW_DB_NAME}" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'airflow_db_user', :'airflow_db_password')
WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = :'airflow_db_user') \gexec
SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'airflow_db_user', :'airflow_db_password')
WHERE EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = :'airflow_db_user') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'airflow_db_name', :'airflow_db_user')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'airflow_db_name') \gexec
SELECT format('ALTER DATABASE %I OWNER TO %I', :'airflow_db_name', :'airflow_db_user') \gexec
SELECT format('GRANT ALL PRIVILEGES ON DATABASE %I TO %I', :'airflow_db_name', :'airflow_db_user') \gexec
SQL
