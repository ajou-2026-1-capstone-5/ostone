#!/usr/bin/env bash
set -euo pipefail

for path in /opt/airflow/logs /opt/airflow/artifacts /opt/airflow/auth; do
  mkdir -p "${path}"
  test -w "${path}"
done

passwords_file="${AIRFLOW__CORE__SIMPLE_AUTH_MANAGER_PASSWORDS_FILE:-/opt/airflow/auth/simple_auth_manager_passwords.json.generated}"
cat > "${passwords_file}" <<EOF
{"admin": "${AIRFLOW_SIMPLE_ADMIN_PASSWORD:-admin}", "viewer": "${AIRFLOW_SIMPLE_VIEWER_PASSWORD:-viewer}"}
EOF

/entrypoint airflow db migrate
