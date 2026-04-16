# 인프라 런북: spec/114 스토리지 로컬 개발 세팅

**Scope**: docker-compose MinIO 서비스 추가, application.yml 프로파일별 스토리지 설정 주입
**Out of Scope**: 실제 AWS S3 버킷 생성, IAM 정책/Role 설정, KMS 암호화, Lifecycle 정책 — 별도 인프라 작업으로 분리

---

## 1. docker-compose.yml — MinIO 서비스 추가

기존 `docker-compose.yml`의 `services:` 블록에 아래를 추가한다.

```yaml
  minio:
    image: minio/minio:RELEASE.2025-01-20T14-49-07Z   # floating :latest 금지 — 재현성 보장을 위해 버전 고정
    container_name: init-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin}
    ports:
      - "9000:9000"   # S3 API 포트
      - "9001:9001"   # Web Console 포트
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - init-network
```

`volumes:` 블록에 추가:

```yaml
  minio_data:
```

---

## 2. application.yml — 스토리지 공통 설정 추가

`backend/src/main/resources/application.yml`에 아래 섹션을 추가한다.

```yaml
storage:
  s3:
    # 환경별 버킷 분리 전략: init-raw-files-prod / init-raw-files-dev / init-raw-files-local
    bucket-name: ${STORAGE_S3_BUCKET:init-raw-files-dev}
    region: ${STORAGE_S3_REGION:ap-northeast-2}
    endpoint: ${STORAGE_S3_ENDPOINT:}           # 비어있으면 AWS 기본 엔드포인트 사용
    access-key: ${STORAGE_S3_ACCESS_KEY:}
    secret-key: ${STORAGE_S3_SECRET_KEY:}
    path-style-access: ${STORAGE_S3_PATH_STYLE:false}
```

---

## 3. application-local.yml — MinIO 로컬 오버라이드

`backend/src/main/resources/application-local.yml`에 아래를 추가한다.

```yaml
storage:
  s3:
    bucket-name: init-raw-files-local          # 로컬 전용 버킷
    region: us-east-1                          # MinIO는 region 무관
    endpoint: http://localhost:9000
    access-key: ${MINIO_ROOT_USER:minioadmin}
    secret-key: ${MINIO_ROOT_PASSWORD:minioadmin}
    path-style-access: true                    # MinIO는 path-style 필수
```

> **버킷 전략 요약**:
> - `init-raw-files-local` — MinIO (docker-compose 로컬)
> - `init-raw-files-dev` — AWS S3 개발 환경
> - `init-raw-files-prod` — AWS S3 운영 환경
>
> 워크스페이스 격리는 object key 경로로 처리: `workspaces/{workspaceId}/datasets/{datasetKey}/{filename}`

---

## 4. 환경 변수 목록

| 변수 | 설명 | 기본값 | 사용 프로파일 |
|------|------|--------|--------------|
| `STORAGE_S3_BUCKET` | S3/MinIO 버킷 이름 (환경별 상이) | `init-raw-files-dev` | 환경별 주입 |
| `STORAGE_S3_REGION` | AWS 리전 | `ap-northeast-2` | default (prod) |
| `STORAGE_S3_ENDPOINT` | 커스텀 엔드포인트 | 비어있음 (AWS 기본) | local: MinIO URL |
| `STORAGE_S3_ACCESS_KEY` | AWS Access Key / MinIO User | — | prod: IAM Role 권장 |
| `STORAGE_S3_SECRET_KEY` | AWS Secret Key / MinIO Pass | — | prod: IAM Role 권장 |
| `STORAGE_S3_PATH_STYLE` | Path-style access 여부 | `false` | local: `true` (MinIO) |
| `MINIO_ROOT_USER` | MinIO 루트 사용자 | `minioadmin` | local only |
| `MINIO_ROOT_PASSWORD` | MinIO 루트 비밀번호 | `minioadmin` | local only |

> **보안 주의**: `STORAGE_S3_ACCESS_KEY`, `STORAGE_S3_SECRET_KEY`는 `.env` 파일에만 저장하며
> git에 커밋하지 않는다. AWS prod 환경에서는 Fargate IAM Task Role 사용 권장.

---

## 5. docker-compose 시작 및 MinIO 버킷 초기화 (로컬)

```bash
# docker-compose MinIO 시작
docker-compose up -d minio

# MinIO Web Console로 버킷 생성: http://localhost:9001
# admin 계정: minioadmin / minioadmin

# 또는 mc CLI (MinIO Client) 사용:
# mc alias set local http://localhost:9000 minioadmin minioadmin
# mc mb local/init-raw-files-local
```

---

## 6. Out of Scope — 실제 AWS 작업 (별도 인프라 작업)

아래 항목은 이 스펙의 범위 밖이며 인프라 담당자가 별도로 수행한다.

- 환경별 버킷 생성 (환경에 따라 해당 명령 실행):
  ```bash
  # 개발 환경
  aws s3api create-bucket --bucket init-raw-files-dev --region ap-northeast-2 \
      --create-bucket-configuration LocationConstraint=ap-northeast-2
  # 운영 환경
  aws s3api create-bucket --bucket init-raw-files-prod --region ap-northeast-2 \
      --create-bucket-configuration LocationConstraint=ap-northeast-2
  # (로컬 MinIO 버킷 init-raw-files-local은 위 섹션 5의 mc 명령으로 생성)
  ```
- IAM Policy 생성 (개발: `s3:PutObject`, `s3:GetObject` on `init-raw-files-dev/*`; 운영: 동일 패턴으로 `init-raw-files-prod/*`)
- Fargate Task Role에 위 Policy attach
- KMS 서버 사이드 암호화 (SSE-S3 or SSE-KMS) 설정
- S3 Lifecycle 정책 (장기 보관 → Glacier 전환 등) 설정
- VPC Endpoint 설정 (Fargate → S3 트래픽 비용 최적화)
- 버킷 versioning/접근 제어 설정
