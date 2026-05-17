#!/bin/bash
set -euo pipefail

echo "=== Deploying Airflow (Production) ==="

# Required environment variables
: "${RDS_ENDPOINT:?RDS_ENDPOINT is required}"
: "${AIRFLOW_DB_PASSWORD:?AIRFLOW_DB_PASSWORD is required}"
: "${AIRFLOW_WEBHOOK_SECRET:?AIRFLOW_WEBHOOK_SECRET is required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# docker compose pull (ECR에서 이미지 pull)
echo "Pulling latest images..."
docker compose -f docker-compose.airflow.prod.yml pull

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