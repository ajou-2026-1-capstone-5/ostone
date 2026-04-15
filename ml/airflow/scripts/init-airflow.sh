#!/usr/bin/env bash
set -euo pipefail

for path in /opt/airflow/logs /opt/airflow/artifacts /opt/airflow/auth; do
  mkdir -p "${path}"
  test -w "${path}"
done

passwords_file="${AIRFLOW__CORE__SIMPLE_AUTH_MANAGER_PASSWORDS_FILE:-/opt/airflow/auth/simple_auth_manager_passwords.json.generated}"
AIRFLOW_SIMPLE_ADMIN_PASSWORD="${AIRFLOW_SIMPLE_ADMIN_PASSWORD:?AIRFLOW_SIMPLE_ADMIN_PASSWORD is required}"
AIRFLOW_SIMPLE_VIEWER_PASSWORD="${AIRFLOW_SIMPLE_VIEWER_PASSWORD:?AIRFLOW_SIMPLE_VIEWER_PASSWORD is required}"
python3 - <<'PY' > "${passwords_file}"
import json
import os
import sys

json.dump(
    {
        "admin": os.environ["AIRFLOW_SIMPLE_ADMIN_PASSWORD"],
        "viewer": os.environ["AIRFLOW_SIMPLE_VIEWER_PASSWORD"],
    },
    sys.stdout,
)
PY
printf '\n' >> "${passwords_file}"

/entrypoint airflow db migrate
