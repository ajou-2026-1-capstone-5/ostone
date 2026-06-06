# 배포 가이드

## 1. 개요

본 프로젝트의 운영 배포는 AWS 기반으로 관리한다. 인프라는 Terraform으로 구성하고, `main` 브랜치 변경 시 GitHub Actions가 필요한 이미지를 빌드해 ECR에 push한 뒤 ECS/S3/CloudFront 배포를 수행한다.

**배포 아키텍처**:

```text
GitHub main push
  -> GitHub Actions CI
  -> Terraform apply
  -> ECR image push
  -> ECS service update / S3 sync / CloudFront invalidation
  -> AWS RDS PostgreSQL
```

**사용 서비스**:

| 영역 | 서비스 |
| --- | --- |
| Backend | ECS Fargate, ALB, ECR |
| Frontend | S3 private bucket, CloudFront, ACM, Route53 |
| Database | RDS PostgreSQL 16 |
| Pipeline | ECS Fargate Airflow, ECS ML stage tasks, optional GPU capacity |
| Storage | S3 buckets for raw files, ML artifacts, logs |
| Secrets | AWS Secrets Manager |
| CI/CD | GitHub Actions |

상세 운영 절차는 [`docs/ops/runbook.md`](../../docs/ops/runbook.md)를 우선 기준으로 삼는다.

## 2. 사전 요건

- AWS 계정 및 배포 role
- GitHub Actions environment `prod`
- Terraform remote state용 S3 bucket과 DynamoDB lock table
- Route53 hosted zone 또는 위임 가능한 도메인
- ECR, ECS, RDS, S3, CloudFront 생성 권한

Terraform remote state는 최초 1회 다음 스크립트로 준비한다.

```bash
AWS_REGION=ap-northeast-2 bash infra/terraform/bootstrap.sh
```

## 3. GitHub Actions 설정

### 3.1 Required Secrets

GitHub repository 또는 `prod` environment에 다음 secrets를 설정한다.

| Secret | 용도 |
| --- | --- |
| `AWS_ROLE_ARN` | GitHub OIDC로 assume할 AWS role |
| `PROD_DB_MASTER_PASSWORD` | RDS master password |
| `PROD_APP_DB_PASSWORD` | 애플리케이션 DB user password |
| `PROD_AIRFLOW_DB_PASSWORD` | Airflow DB user password |
| `PROD_JWT_SECRET` | JWT signing secret |
| `PROD_AIRFLOW_API_USERNAME` | Backend가 Airflow API 호출 시 쓰는 사용자명 |
| `PROD_AIRFLOW_API_PASSWORD` | Backend가 Airflow API 호출 시 쓰는 비밀번호 |
| `PROD_AIRFLOW_WEBHOOK_SECRET` | Airflow callback webhook shared secret |
| `PROD_AIRFLOW_FERNET_KEY` | Airflow metadata encryption key |
| `PROD_AIRFLOW_API_SECRET_KEY` | Airflow API secret key |
| `PROD_AIRFLOW_API_AUTH_JWT_SECRET` | Airflow API auth JWT secret |
| `PROD_AIRFLOW_SIMPLE_ADMIN_PASSWORD` | Airflow admin password |
| `PROD_AIRFLOW_SIMPLE_VIEWER_PASSWORD` | Airflow viewer password |
| `PROD_LLM_RUNTIME_API_KEY` | 내부 LLM endpoint API key, 필요 시 |
| `PROD_TOSS_SECRET_KEY` | Toss Payments v2 API secret key (`TF_VAR_toss_secret_key`) |
| `PROD_TOSS_WEBHOOK_SECRET` | Toss Payments webhook 서명 검증 secret (`TF_VAR_toss_webhook_secret`) |
| `PROD_TOSS_BILLING_KEY_ENCRYPTION_KEY` | Toss 빌링 키 암호화 key (`TF_VAR_toss_billing_key_encryption_key`) |

### 3.2 Required Variables

| Variable | 예시 |
| --- | --- |
| `PROD_DOMAIN_NAME` | `ostone.example.com` |
| `PROD_ROUTE53_ZONE_ID` | 기존 hosted zone ID, 자동 조회 시 빈 값 |
| `PROD_MANAGE_ROUTE53_ZONE` | `false` |
| `PROD_ADMIN_CIDR` | `203.0.113.10/32` |
| `PROD_AIRFLOW_API_BASE_URL` | 빈 값 또는 `https://airflow.<domain>`; `TF_VAR_airflow_api_base_url`로 전달 |
| `PROD_AIRFLOW_API_ALLOW_INSECURE_HTTP` | `false`; `TF_VAR_airflow_api_allow_insecure_http`로 전달 |
| `PROD_API_BASE_URL` | `https://api.<domain>/api/v1` |
| `PROD_WS_URL` | `wss://api.<domain>` |
| `PROD_BACKEND_DESIRED_COUNT` | `0` (최초 apply 기본값; 앱 이미지 배포 후 `1` 이상 권장) |
| `PROD_BACKEND_AUTOSCALING_MIN_CAPACITY` | `1` |
| `PROD_BACKEND_AUTOSCALING_MAX_CAPACITY` | `3` |
| `PROD_GPU_INSTANCE_TYPE` | `g6.2xlarge` |
| `PROD_GPU_ASG_MAX_SIZE` | `1` |
| `PROD_GPU_ASG_DESIRED_CAPACITY` | `0` |
| `PROD_EMBEDDING_MODEL_NAME` | `BAAI/bge-m3` |
| `PROD_ML_RUNTIME_PROFILE` | `balanced` |
| `PROD_LLM_MODEL_NAME` | `Qwen/Qwen3-14B` |
| `PROD_LLM_MODEL_PATH` | `/models/model.gguf` |
| `PROD_LLM_SERVICE_DESIRED_COUNT` | `0` |
| `PROD_TOSS_CLIENT_KEY` | Toss Payments client key; frontend build에 `VITE_TOSS_CLIENT_KEY`로 주입 |

## 4. 인프라 배포

Terraform 구성은 [`infra/terraform`](../../infra/terraform)에 있다.

```bash
cd infra/terraform
terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```

주요 output:

```bash
terraform output api_endpoint
terraform output airflow_endpoint
terraform output frontend_bucket_name
terraform output cloudfront_distribution_id
terraform output ecs_cluster_name
terraform output backend_service_name
terraform output backend_task_definition_arn
terraform output rds_address
# 배포 workflow가 Airflow 서비스/태스크 갱신과 네트워킹에 사용하는 output
terraform output airflow_apiserver_service_name
terraform output airflow_scheduler_service_name
terraform output airflow_dag_processor_service_name
terraform output airflow_init_task_definition_arn
terraform output airflow_apiserver_task_definition_arn
terraform output airflow_scheduler_task_definition_arn
terraform output airflow_dag_processor_task_definition_arn
terraform output private_subnet_ids
terraform output ecs_airflow_security_group_id
```

## 5. 자동 배포

`main` 브랜치 push 시 [`.github/workflows/prod-deploy.yml`](../../.github/workflows/prod-deploy.yml)이 실행된다.

- Backend 변경: Gradle `bootJar` 후 `ostone/backend` 이미지를 ECR에 push하고 ECS service를 새 task definition으로 갱신한다.
- Frontend 변경: `pnpm build` 후 S3에 `frontend/dist/`를 sync하고 CloudFront invalidation을 생성한다.
- ML 변경: CPU/GPU ML stage 이미지를 ECR에 push하고 Airflow 이미지를 갱신한다.
- Terraform 변경: apply 후 필요한 배포 job이 Terraform output을 사용한다.

인프라만 수동으로 검토/적용하려면 [`.github/workflows/terraform-cd.yml`](../../.github/workflows/terraform-cd.yml)을 수동 실행한다.

## 6. 운영 환경 변수

Backend ECS task definition은 Terraform이 다음 값을 주입한다.

| 변수 | 출처 |
| --- | --- |
| `SPRING_PROFILES_ACTIVE=prod` | Terraform environment |
| `SERVER_PORT=8080` | Terraform environment |
| `DB_HOST`, `DB_PORT`, `DB_NAME` | RDS output |
| `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` | Secrets Manager |
| `JWT_SECRET` | Secrets Manager |
| `CORS_ALLOWED_ORIGINS` | `https://app.<domain>` |
| `STORAGE_S3_BUCKET`, `STORAGE_S3_REGION` | Terraform S3 resources |
| `AIRFLOW_API_BASE_URL` | private Cloud Map endpoint by default |
| `AIRFLOW_API_ALLOW_INSECURE_HTTP` | `TF_VAR_airflow_api_allow_insecure_http` |
| `AIRFLOW_API_USERNAME`, `AIRFLOW_API_PASSWORD` | Secrets Manager |
| `AIRFLOW_WEBHOOK_SECRET` | Secrets Manager |
| `AWS_REGION` | Terraform environment |
| `STORAGE_S3_SSE_ENABLED` | Terraform environment (`"true"`) |
| `AI_EMBEDDING_*` (provider/model/bedrock region/enabled/timeout 및 threshold·floor·margin 다수) | Terraform environment |
| `AI_CHAT_PROVIDER`, `AI_CHAT_BEDROCK_REGION`, `AI_CHAT_BEDROCK_MODEL` | Terraform environment (Bedrock Converse) |
| `TOSS_SECRET_KEY`, `TOSS_WEBHOOK_SECRET`, `TOSS_BILLING_KEY_ENCRYPTION_KEY` | Secrets Manager |

> `AI_EMBEDDING_*` 전체 키 목록과 기본값은 [`infra/terraform/ecs-cluster.tf`](../../infra/terraform/ecs-cluster.tf)의 backend container `environment` 블록을 기준으로 한다. Backend ECS service는 CPU 사용률 70% target의 auto scaling이 적용된다(min/max는 `PROD_BACKEND_AUTOSCALING_*` 변수).

Frontend build는 GitHub Actions variables `PROD_API_BASE_URL`, `PROD_WS_URL`, `PROD_TOSS_CLIENT_KEY`를 사용한다(각각 `VITE_API_BASE_URL`, `VITE_WS_URL`, `VITE_TOSS_CLIENT_KEY`로 주입).

## 7. S3 / IAM

원본 상담 로그는 `corpus` 모듈의 `RawFileStoragePort`를 통해 S3에 저장된다. 로컬은 MinIO, 운영은 AWS S3를 같은 adapter 경로로 사용한다.

| 항목 | 운영 기준 |
| --- | --- |
| Region | `ap-northeast-2` |
| 객체 경로 | `workspaces/{workspaceId}/datasets/{datasetKey}/{uuid}_{filename}` |
| 기본 암호화 | SSE-S3 |
| Public Access | 전부 차단 |
| 버저닝 | Enabled |
| 권한 | ECS task role과 pipeline task role에 bucket/prefix 한정 권한 부여 |

로컬에서 운영 S3를 확인해야 할 때는 [`aws-sso-setup.md`](aws-sso-setup.md)를 따른다. 일반 개발은 MinIO를 사용한다.

## 8. 트러블슈팅

### Terraform Cloud Map 권한 실패

증상:

```text
AccessDeniedException: ... is not authorized to perform:
servicediscovery:CreatePrivateDnsNamespace
```

원인: Backend가 VPC 내부에서 Airflow API를 호출하도록 AWS Cloud Map private DNS namespace를 생성하는데, Terraform 실행 role에 Service Discovery 권한이 없을 수 있다.

자동 복구: production deploy와 Terraform CD workflow는 Terraform 실행 전에 `infra/aws/github-actions-terraform-servicediscovery-policy.json`을 `ostone-terraform-servicediscovery` inline policy로 붙인다.

수동 복구:

```bash
aws iam put-role-policy \
  --role-name ostone-prod-github-actions-terraform \
  --policy-name ostone-terraform-servicediscovery \
  --policy-document file://infra/aws/github-actions-terraform-servicediscovery-policy.json
```

### ECS 서비스가 기동하지 않음

1. CloudWatch Logs `/ecs/ostone-prod/backend` 확인
2. ALB target group health check `/actuator/health` 확인
3. ECS service event에서 image pull, secret injection, DB connection 오류 확인
4. RDS security group과 ECS task security group 간 5432 ingress/egress 확인

### Frontend 변경이 보이지 않음

1. GitHub Actions frontend job 성공 여부 확인
2. S3 sync 대상 bucket 확인
3. CloudFront invalidation 완료 여부 확인
4. 브라우저 cache 우회 후 `https://app.<domain>` 재접속
