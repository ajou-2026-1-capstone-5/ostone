# AWS ECS 프로덕션 배포 Runbook

이 문서는 `ostone-prod` 환경의 초기 배포, 자동 배포 확인, Health Check, 장애 시 롤백 절차를 정리한다. 명령은 저장소 루트에서 실행하는 것을 기준으로 한다.

## Pre-Deploy Checklist

- [ ] Terraform plan 검토, 변경 사항 확인
- [ ] AWS CLI 인증 확인
  ```bash
  aws sts get-caller-identity
  ```
- [ ] ECR 로그인 확인
  ```bash
  aws ecr get-login-password --region ap-northeast-2
  ```
- [ ] GitHub Actions Secrets 확인
  - `AWS_ROLE_ARN`
  - `FRONTEND_S3_BUCKET`
  - `CLOUDFRONT_DISTRIBUTION_ID`
- [ ] GitHub Actions Variables 확인
  - `PROD_API_BASE_URL` = `https://api.<domain>/api/v1`
  - `PROD_WS_URL` = `wss://api.<domain>`
  - `PROD_DOMAIN_NAME`
  - `PROD_ADMIN_CIDR`
  - `PROD_AIRFLOW_API_BASE_URL`
  - `PROD_AIRFLOW_API_ALLOW_INSECURE_HTTP` = `true` only when Airflow API is private HTTP
  - `PROD_SNS_EMAIL`
  - `PROD_GPU_INSTANCE_TYPE` = `g6.2xlarge` by default
  - `PROD_EMBEDDING_MODEL_NAME` = `BAAI/bge-m3` by default
  - `PROD_LLM_MODEL_NAME`
  - `PROD_LLM_MODEL_PATH`
  - `PROD_LLM_SERVICE_DESIRED_COUNT` = `0` unless the LLM service should stay warm
- [ ] GitHub Actions Terraform Secrets 확인
  - `PROD_DB_MASTER_PASSWORD`
  - `PROD_APP_DB_PASSWORD`
  - `PROD_AIRFLOW_DB_PASSWORD`
  - `PROD_JWT_SECRET`
  - `PROD_AIRFLOW_API_USERNAME`
  - `PROD_AIRFLOW_API_PASSWORD`
  - `PROD_AIRFLOW_WEBHOOK_SECRET`
  - `PROD_LLM_RUNTIME_API_KEY` when the internal LLM service enforces an API key
- [ ] Terraform remote state 준비 확인
  ```bash
  AWS_REGION=ap-northeast-2 bash infra/terraform/bootstrap.sh
  ```
- [ ] 최신 `main` 브랜치 pull 확인

## Deploy Steps

### 1. Terraform Apply, 초기 배포 시

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars  # 실제 값 입력
# Airflow EC2 private URL을 정한 뒤 airflow_api_base_url도 실제 값으로 수정
# private HTTP를 쓰는 경우 airflow_api_allow_insecure_http = true
terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```

배포 후 다음 output을 확인한다.

```bash
terraform output ecs_cluster_name
terraform output backend_service_name
terraform output frontend_bucket_name
terraform output cloudfront_distribution_id
terraform output rds_address
terraform output api_endpoint
```

### 2. RDS init

`init.sql`은 애플리케이션/ Airflow 전용 DB role과 schema 권한을 준비한다. `terraform.tfvars`의 `app_db_password`, `airflow_db_password`, `db_name`과 동일한 값을 `psql -v`로 넘긴다.

```bash
psql -h $(terraform -chdir=infra/terraform output -raw rds_address) \
  -U $(terraform -chdir=infra/terraform output -raw db_master_username 2>/dev/null || echo ostone_admin) \
  -d <db_name> \
  -v db_name=<db_name> \
  -v app_db_password='<app_db_password>' \
  -v airflow_db_password='<airflow_db_password>' \
  -f infra/terraform/scripts/init.sql
```

### 3. ECR 이미지 Push, 초기 배포 시

#### Backend

```bash
cd backend
./gradlew bootJar
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --password-stdin -u AWS <account>.dkr.ecr.ap-northeast-2.amazonaws.com
docker build -f Dockerfile.prod -t ostone/backend:latest .
docker tag ostone/backend:latest <account>.dkr.ecr.ap-northeast-2.amazonaws.com/ostone/backend:latest
docker push <account>.dkr.ecr.ap-northeast-2.amazonaws.com/ostone/backend:latest
aws ecs update-service \
  --cluster $(terraform -chdir=../infra/terraform output -raw ecs_cluster_name) \
  --service $(terraform -chdir=../infra/terraform output -raw backend_service_name) \
  --force-new-deployment \
  --region ap-northeast-2
```

#### Frontend

```bash
cd frontend
pnpm install
VITE_API_BASE_URL=https://api.<domain>/api/v1 VITE_WS_URL=wss://api.<domain> pnpm build
aws s3 sync dist/ s3://$(terraform -chdir=../infra/terraform output -raw frontend_bucket_name)/ --delete
aws cloudfront create-invalidation \
  --distribution-id $(terraform -chdir=../infra/terraform output -raw cloudfront_distribution_id) \
  --paths "/*"
```

#### ML embedder

```bash
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --password-stdin -u AWS <account>.dkr.ecr.ap-northeast-2.amazonaws.com
docker build -f ml/Dockerfile.gpu -t ostone/ml-embedder:latest .
docker tag ostone/ml-embedder:latest <account>.dkr.ecr.ap-northeast-2.amazonaws.com/ostone/ml-embedder:latest
docker push <account>.dkr.ecr.ap-northeast-2.amazonaws.com/ostone/ml-embedder:latest
```

#### Internal LLM service

The production LLM endpoint is an internal OpenAI-compatible ECS service behind the private `ml_llm_runtime_base_url` output. Keep `llm_service_desired_count = 0` for scale-to-zero, and raise it to `1` only when a warm local LLM is needed for label/description/policy enrichment. The model file should be available under the GPU host model cache path mounted into the container as `/models`.

### 4. Airflow EC2 배포

`ml/docker-compose.airflow.prod.yml`은 RDS PostgreSQL을 Airflow 메타데이터 DB로 사용하고, DAG 경로는 `/opt/airflow/src/dags`다. 원격 EC2에는 아래 필수 환경 변수를 먼저 설정한다.

- `AIRFLOW_DB_PASSWORD`
- `RDS_ENDPOINT`
- `AIRFLOW_WEBHOOK_SECRET`
- `AIRFLOW_FERNET_KEY`
- `AIRFLOW__API__SECRET_KEY`
- `AIRFLOW__API_AUTH__JWT_SECRET`
- `AIRFLOW_SIMPLE_ADMIN_PASSWORD`
- `AIRFLOW_SIMPLE_VIEWER_PASSWORD`
- `PIPELINE_BACKEND_BASE_URL` = `https://api.<domain>`
- `ML_ARTIFACT_BUCKET` = `$(terraform -chdir=infra/terraform output -json s3_bucket_names | jq -r .ml_artifacts)`
- `ECS_GPU_CLUSTER_NAME` = `$(terraform -chdir=infra/terraform output -raw ecs_cluster_name)`
- `ECS_GPU_CAPACITY_PROVIDER` = `$(terraform -chdir=infra/terraform output -raw gpu_capacity_provider_name)`
- `ECS_GPU_ASG_NAME` = `$(terraform -chdir=infra/terraform output -raw gpu_asg_name)`
- `ECS_EMBEDDER_TASK_DEFINITION` = `$(terraform -chdir=infra/terraform output -raw ml_embedder_task_definition_arn)`
- `LLM_RUNTIME_BASE_URL` = `$(terraform -chdir=infra/terraform output -raw ml_llm_runtime_base_url)`

```bash
ssh ec2-user@<airflow-ip> "mkdir -p ~/ml"
rsync -avz ml/docker-compose.airflow.prod.yml ml/deploy-airflow.sh ml/airflow ec2-user@<airflow-ip>:~/ml/
rsync -avz ml/src/ ec2-user@<airflow-ip>:~/ml/src/
ssh ec2-user@<airflow-ip> "bash ml/deploy-airflow.sh"
```

### 5. GitHub Actions CI/CD, 이후 자동 배포

`main` 브랜치 push 시 `.github/workflows/prod-deploy.yml`이 실행된다.

- Backend 변경 시 Java 21로 `./gradlew bootJar --no-daemon -x checkstyleMain -x checkstyleTest`를 실행하고, `ostone/backend` 이미지를 ECR에 `github.sha`와 `latest` 태그로 push한 뒤 새 ECS task definition revision을 등록해 서비스를 재배포한다.
- Frontend 변경 시 Node 22와 pnpm으로 빌드하고, `FRONTEND_S3_BUCKET`에 `frontend/dist/`를 sync한 뒤 CloudFront invalidation을 생성한다.
- ML 변경 시 `ml/Dockerfile.gpu`를 빌드하고 `ostone/ml-embedder` 이미지를 ECR에 `github.sha`와 `latest` 태그로 push한다.

## Health Check Commands

```bash
# ECS Service 상태 확인
aws ecs describe-services \
  --cluster ostone-prod-cluster \
  --services ostone-backend \
  --region ap-northeast-2

# ALB Health Check
curl -sfk https://api.ostone.io/actuator/health

# API 엔드포인트 검증
curl -sfk https://api.ostone.io/api/v1/workspace

# Frontend 접속 확인
curl -sfk https://app.ostone.io/ | grep -o '<html'

# RDS 연결 확인
aws rds describe-db-instances \
  --db-instance-identifier ostone-prod-postgres \
  --region ap-northeast-2

# CloudWatch Logs 확인
aws logs get-log-events \
  --log-group-name /ecs/ostone-prod/backend \
  --limit 5 \
  --region ap-northeast-2

# CloudFront Invalidation 확인
aws cloudfront list-invalidations \
  --distribution-id $(terraform -chdir=infra/terraform output -raw cloudfront_distribution_id) \
  --max-items 1

# ECR 이미지 확인
aws ecr describe-images \
  --repository-name ostone/backend \
  --query 'imageDetails[?imageTags[?@==`latest`]]' \
  --region ap-northeast-2
```

## Rollback Procedure

### Backend ECS Rollback

이전 task definition revision을 확인한다.

```bash
aws ecs describe-services \
  --cluster ostone-prod-cluster \
  --services ostone-backend \
  --query 'services[0].deployments[0].taskDefinition' \
  --region ap-northeast-2
```

이전 revision으로 서비스를 업데이트한다.

```bash
aws ecs update-service \
  --cluster ostone-prod-cluster \
  --service ostone-backend \
  --task-definition ostone-prod-backend-task:<previous-revision> \
  --force-new-deployment \
  --region ap-northeast-2
```

업데이트 후 `Health Check Commands`의 ECS, ALB, API, CloudWatch 명령을 다시 실행한다.

### Frontend Rollback

마지막 정상 버전의 `dist/` 산출물이 있으면 해당 산출물을 프론트엔드 버킷에 다시 sync한다.

```bash
aws s3 sync <known-good-dist>/ s3://$(terraform -chdir=infra/terraform output -raw frontend_bucket_name)/ --delete
aws cloudfront create-invalidation \
  --distribution-id $(terraform -chdir=infra/terraform output -raw cloudfront_distribution_id) \
  --paths "/*"
```

버전 관리된 S3 객체를 사용해 특정 객체 버전으로 되돌리는 경우, 복원 대상 파일 목록과 버전을 확인한 뒤 필요한 객체만 복사한다. DB migration rollback은 이 절차에 포함하지 않는다.

### RDS Rollback, 수동 스냅샷

```bash
aws rds describe-db-snapshots \
  --db-instance-identifier ostone-prod-postgres \
  --region ap-northeast-2

aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier ostone-prod-postgres-restore \
  --db-snapshot-identifier ostone-prod-postgres-final-<timestamp> \
  --region ap-northeast-2
```

복원 인스턴스 검증 후 애플리케이션 연결 전환은 별도 변경 승인 절차로 진행한다.

## 운영 정보

| 항목 | 값 |
| --- | --- |
| AWS Region | `ap-northeast-2` |
| ECS Cluster | `ostone-prod-cluster` |
| ECS Service | `ostone-backend`, Fargate, 0.5 vCPU, 1GB |
| Backend Task Definition | `ostone-prod-backend-task` |
| ALB DNS | `api.ostone.io`, Backend Target Group 8080 |
| RDS | `ostone-prod-postgres`, `db.t4g.medium`, 20GB gp3, PostgreSQL 16, Multi-AZ |
| S3 Frontend | `$(terraform output -raw frontend_bucket_name)`, Terraform default `ostone-prod-frontend` |
| CloudWatch Dashboard | `ostone-prod` |
| SNS Alarm Topic | `ostone-prod-alerts` |
| ECR Repositories | `ostone/backend`, `ostone/airflow`, `ostone/ml-embedder`, `ostone/ml-llm` |
| GPU Runtime | Shared ECS GPU capacity provider, default `g6.2xlarge`, scale from 0 |
| ML Embedder | ECS GPU RunTask, local `BAAI/bge-m3`, no external embedding API |
| ML LLM | Internal OpenAI-compatible ECS service, private ALB, used only for draft enrichment |
| Backend Log Group | `/ecs/ostone-prod/backend` |
| ML Embedder Log Group | `/ecs/ostone-prod/ml-embedder` |
| ML LLM Log Group | `/ecs/ostone-prod/ml-llm` |

## 참고 Terraform Outputs

운영 명령에서 실제 리소스 값이 필요할 때는 하드코딩하지 말고 Terraform output을 우선 사용한다.

```bash
terraform -chdir=infra/terraform output -raw ecs_cluster_name
terraform -chdir=infra/terraform output -raw backend_service_name
terraform -chdir=infra/terraform output -raw frontend_bucket_name
terraform -chdir=infra/terraform output -raw cloudfront_distribution_id
terraform -chdir=infra/terraform output -raw rds_address
terraform -chdir=infra/terraform output -raw alb_dns_name
terraform -chdir=infra/terraform output -raw api_endpoint
```
