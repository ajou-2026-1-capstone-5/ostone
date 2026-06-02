#!/usr/bin/env bash
set -euo pipefail

for path in /opt/airflow/logs /opt/airflow/artifacts /opt/airflow/auth "${HF_HOME:-/opt/airflow/.cache/huggingface}"; do
  mkdir -p "${path}"
  test -w "${path}"
done

/opt/airflow/scripts/write-simple-auth-passwords.sh

/entrypoint airflow db migrate
