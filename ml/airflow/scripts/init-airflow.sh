#!/usr/bin/env bash
set -euo pipefail

for path in /opt/airflow/logs /opt/airflow/artifacts /opt/airflow/auth; do
  mkdir -p "${path}"
  test -w "${path}"
done

/entrypoint airflow db migrate
