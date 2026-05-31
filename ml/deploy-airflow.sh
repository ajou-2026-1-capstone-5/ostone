#!/bin/bash
set -euo pipefail

echo "=== Deploying Airflow (Production) ==="

# Required environment variables
: "${RDS_ENDPOINT:?RDS_ENDPOINT is required}"
: "${AIRFLOW_DB_PASSWORD:?AIRFLOW_DB_PASSWORD is required}"
: "${AIRFLOW_WEBHOOK_SECRET:?AIRFLOW_WEBHOOK_SECRET is required}"
: "${AIRFLOW_FERNET_KEY:?AIRFLOW_FERNET_KEY is required}"
: "${AIRFLOW__API__SECRET_KEY:?AIRFLOW__API__SECRET_KEY is required}"
: "${AIRFLOW__API_AUTH__JWT_SECRET:?AIRFLOW__API_AUTH__JWT_SECRET is required}"
: "${AIRFLOW_SIMPLE_ADMIN_PASSWORD:?AIRFLOW_SIMPLE_ADMIN_PASSWORD is required}"
: "${AIRFLOW_SIMPLE_VIEWER_PASSWORD:?AIRFLOW_SIMPLE_VIEWER_PASSWORD is required}"
: "${PIPELINE_BACKEND_BASE_URL:?PIPELINE_BACKEND_BASE_URL is required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Build Airflow image from the checked-out production Dockerfile.
echo "Building Airflow image..."
docker compose -f docker-compose.airflow.prod.yml build --pull

# airflow-init 실행 (DB 마이그레이션)
echo "Running Airflow DB init..."
if ! docker compose -f docker-compose.airflow.prod.yml up --wait airflow-init; then
  echo "Airflow init failed, checking logs..."
  docker compose -f docker-compose.airflow.prod.yml logs airflow-init
  exit 1
fi

# 전체 서비스 시작
echo "Starting Airflow services..."
docker compose -f docker-compose.airflow.prod.yml up -d

echo "=== Airflow deployment complete ==="
echo "Webserver: http://$(hostname -I | awk '{print $1}'):8080"
