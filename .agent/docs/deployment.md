# 배포 가이드

## 1. 개요

본 프로젝트는 Render의 GitHub 네이티브 연동을 통해 `main` 브랜치 변경 시 자동 배포된다. GitHub Actions는 CI 품질 게이트까지만 담당하고, 실제 배포 트리거와 배포 상태 관리는 Render가 직접 수행한다.

**배포 아키텍처**:

```
GitHub (main push) → GitHub Actions CI 워크플로우 (품질 게이트) → Render GitHub 연동 → Render 빌드/배포 → Neon DB
```

**사용 서비스**:

- **Backend**: Render Web Service (Docker runtime, 무료 티어)
- **Frontend**: Render Static Site (Vite 빌드, SPA 라우팅)
- **Database**: Neon PostgreSQL (무료 티어, 0.5GB)
- **CI**: GitHub Actions
- **CD**: Render Native GitHub Integration

## 2. 사전 요건

- GitHub 저장소
- Render 계정 (https://render.com)
- Neon 계정 (https://neon.tech)

## 3. Neon PostgreSQL 설정

### 3.1 프로젝트 생성

1. Neon 대시보드에서 새 프로젝트 생성
2. 데이터베이스명: `neondb` (기본값)
3. Region: Render와 동일 또는 가까운 지역 선택 (latency 최소화)

### 3.2 Connection String 확인

1. Neon 대시보드 → Connection Details
2. **Connection string (Direct connection)** 복사
3. 형식: `jdbc:postgresql://ep-xxx.region.aws.neon.tech:5432/neondb?sslmode=require`

### 3.3 PgBouncer 주의사항

Neon은 PgBouncer pooler endpoint도 제공하지만, **반드시 Direct connection을 사용해야 한다**.

**이유**: PgBouncer pooler는 세션 풀링 모드에서 일부 SQL 구문을 지원하지 않아 Liquibase 마이그레이션에 실패할 수 있다.

- ✅ **사용**: `ep-xxx.region.aws.neon.tech:5432` (Direct)
- ❌ **사용 금지**: `ep-xxx.region.aws.neon.tech:6543` (Pooler)

## 4. Render 설정

### 4.1 Blueprint 배포

`render.yaml` 파일이 프로젝트 루트에 이미 있으므로 Blueprint로 서비스 생성 가능:

1. Render 대시보드 → New Blueprint Instance
2. GitHub 저장소 선택, `chore/add-cd-pipeline` (또는 `main`) 브랜치 선택
3. Blueprint가 Backend, Frontend 두 서비스 생성

### 4.2 자동 생성된 Blueprint에서 반드시 확인

**Auto-Deploy: ON**

⚠️ **중요: 네이티브 연동으로 운영할 경우 Auto-Deploy를 ON으로 유지해야 한다.**

Render Blueprint 배포 시 "Auto-Deploy" 옵션이 자동으로 ON되어 있다. 네이티브 연동으로 운영할 때는 이 설정을 유지해야 하며, 배포 흐름은 다음처럼 단순해진다.

- GitHub push → Render가 GitHub 변경을 감지
- Render가 연결된 서비스별로 빌드/배포 수행
- 배포 상태와 로그는 Render 대시보드에서 직접 확인

따라서 Blueprint 생성 후 각 서비스의 Settings에서 Auto-Deploy가 **ON**인지 확인해야 한다. 만약 꺼져 있다면 Render가 GitHub 변경을 자동으로 배포하지 못한다.

**설정 경로**: Render Dashboard → 서비스 선택 → Settings → Auto-Deploy → ON

### 4.3 수동 생성 (대안)

Blueprint 대신 대시보드에서 수동 생성:

#### Backend Web Service

- **Name**: ostone-backend
- **Region**: Oregon (us-west-2)
- **Branch**: main
- **Runtime**: Docker
- **Root Directory**: backend
- **Plan**: Free
- 환경변수 설정 (아래 참조)

#### Frontend Static Site

- **Name**: ostone-frontend
- **Region**: Oregon (us-west-2)
- **Branch**: main
- **Runtime**: Static
- **Root Directory**: frontend
- **Build Command**: `pnpm install && pnpm build`
- **Publish Directory**: dist
- **Plan**: Free
- 환경변수 설정 (아래 참조)

### 4.4 환경변수 설정

#### Backend 환경변수 (Render Dashboard → Backend → Environment)

| 변수                         | 값                                      | 설명                                      |
| ---------------------------- | --------------------------------------- | ----------------------------------------- |
| `SPRING_PROFILES_ACTIVE`     | `dev`                                   | dev용 Spring 프로파일 활성화              |
| `SERVER_PORT`                | `10000`                                 | Render 기본 포트                          |
| `SPRING_DATASOURCE_URL`      | `jdbc:postgresql://...?sslmode=require` | Neon Direct Connection String             |
| `SPRING_DATASOURCE_USERNAME` | (Neon 유저명)                           | Neon DB 사용자                            |
| `SPRING_DATASOURCE_PASSWORD` | (Neon 비밀번호)                         | Neon DB 비밀번호                          |
| `JWT_SECRET`                 | (랜덤 문자열)                           | JWT 서명 키 (충분히 길게, 32자 이상 권장) |
| `CORS_ALLOWED_ORIGINS`       | `https://ostone-frontend.onrender.com`  | Render Frontend URL                       |

#### Frontend 환경변수 (Render Dashboard → Frontend → Environment)

| 변수                | 값                                           | 설명                                      |
| ------------------- | -------------------------------------------- | ----------------------------------------- |
| `VITE_API_BASE_URL` | `https://ostone-backend.onrender.com/api/v1` | Backend API 전체 URL                      |
| `VITE_WS_URL`       | `wss://ostone-backend.onrender.com`          | STOMP WebSocket origin (`/ws/chat` 제외) |

## 5. GitHub-Render 연결 확인

Render Dashboard에서 각 서비스가 올바른 GitHub 저장소와 브랜치에 연결되어 있는지만 확인하면 된다.

### Backend / Frontend 공통 확인 항목

1. Render Dashboard → 서비스 선택 → Settings
2. **Repository**가 현재 GitHub 저장소로 연결되어 있는지 확인
3. **Branch**가 `main`으로 설정되어 있는지 확인
4. **Auto-Deploy**가 ON인지 확인

별도의 Render API Key나 서비스 ID를 GitHub Secrets에 넣을 필요는 없다. 이번 구조에서는 GitHub Actions가 Render API를 직접 호출하지 않는다.

## 6. 배포 동작 순서

1. 개발자가 `main` 브랜치에 push (또는 PR merge)
2. CI 워크플로우 자동 실행 (빌드, 테스트, 린트)
3. Render가 GitHub 저장소의 `main` 변경을 감지
4. Backend/Frontend 서비스가 각각 새 빌드와 배포 수행
5. 배포 성공/실패와 상세 로그는 Render 대시보드에서 확인
6. 이전 배포 이력은 Render에서 보관 (rollback 가능)

## 7. 무료 티어 제한사항

### Render Web Service (무료)

- **RAM**: 512MB
- **CPU**: 0.1 CPU
- **월간 무료 시간**: 750시간 (월간 한도, 모든 서비스에 공유)
- **미사용 시**: 15분 후 sleep (cold start ~60초)
- **디스크**: 1GB

### Neon PostgreSQL (무료)

- **저장 용량**: 0.5GB
- **Compute**: 0.25 vCPU, 256MB RAM
- **미사용 시**: autoscale down (cold start 있음)
- **백업**: 자동 7일 보관
- **브랜치**: 3개까지

### 대응 방안

1. **Cold start 대비**: 데모/평가 전 미리 요청 1회 전송하여 wake-up
2. **메모리 최적화**: JVM heap 384MB 제한 (`-Xmx384m`)
3. **DB pool 최소화**: HikariCP maximum-pool-size=5

## 8. 트러블슈팅

### CORS 오류

**증상**: Browser console에서 CORS policy 오류 발생
**해결**:

1. Backend 환경변수 `CORS_ALLOWED_ORIGINS`에 Frontend URL 확인
2. Render Dashboard → Backend → Environment → `CORS_ALLOWED_ORIGINS` 값 확인
3. 형식: `https://ostone-frontend.onrender.com` (마침표 없음, https 필수)

### DB 연결 실패

**증상**: Spring Boot 기동 시 datasource 연결 오류
**해결**:

1. `SPRING_DATASOURCE_URL`에 `?sslmode=require` 포함 확인
2. Direct connection 사용 중인지 확인 (pooler 아님)
3. Neon Dashboard에서 connection string 재확인

### Terraform Cloud Map 권한 실패

**증상**: GitHub Actions production deploy 또는 Terraform CD에서 다음처럼 Service Discovery 권한 오류가 발생한다.

```text
AccessDeniedException: ... is not authorized to perform:
servicediscovery:CreatePrivateDnsNamespace
```

**원인**: Airflow ECS API는 backend가 VPC 내부에서 호출할 수 있도록 AWS Cloud Map private DNS namespace를 생성한다. Terraform 실행 role(`AWS_ROLE_ARN`)에 `servicediscovery:*` 계열 권한이 없으면 namespace/service 생성 단계에서 배포가 중단된다.

**자동 복구**: production deploy와 Terraform CD workflow는 Terraform 실행 전에 `infra/aws/github-actions-terraform-servicediscovery-policy.json`을 `ostone-terraform-servicediscovery` inline policy로 붙인다. Terraform role이 `iam:PutRolePolicy`를 허용하면 다음 배포 재시도에서 자동으로 복구된다.

**수동 복구**: 자동 복구 단계가 `iam:PutRolePolicy` 권한으로 실패하면, 배포 계정 관리자 권한으로 아래 명령을 한 번 실행한 뒤 workflow를 재실행한다.

```bash
aws iam put-role-policy \
  --role-name ostone-prod-github-actions-terraform \
  --policy-name ostone-terraform-servicediscovery \
  --policy-document file://infra/aws/github-actions-terraform-servicediscovery-policy.json
```

### OOM (Out of Memory)

**증상**: 서비스가 갑자기 재시작되거나 응답 없음
**해결**:

1. Render Dashboard → Logs에서 "OOMKilled" 또는 "ExitOnOutOfMemoryError" 확인
2. HikariCP pool size를 더 작게 조정 (현재 5)
3. JVM heap 추가 축소 고려 (현재 `-Xmx384m`)

### Cold start 지연

**증상**: 첫 요청 시 30~60초 대기
**해결**:

1. Render 무료 티어 특성 (sleep 후 재시작)
2. 데모/평가 전 수동 wake-up: Render Dashboard → Deploy → Manual Deploy
3. 또는 wake-up script로 주기적 요청 전송

## 9. AWS S3 / IAM (운영)

ostone 의 파일 업로드(원본 상담 로그)는 `corpus` 모듈 → `RawFileStoragePort` → `S3RawFileStorageAdapter` 흐름으로 처리되며, 객체는 운영 S3 버킷에 저장된다. 로컬은 MinIO, 운영은 실제 AWS S3 를 같은 추상으로 사용한다.

### 9.1 운영 인프라 (Phase B/C 산출물)

실제 값(AWS 계정 ID, 운영 버킷명, SSO 포털 URL 등)은 git 에 커밋하지 않는다. 팀 운영 채널(1Password "ostone AWS" 노트 또는 비공개 채널)에서 공유한다.

| 항목 | 값 |
| --- | --- |
| AWS 계정 ID | `<AWS_ACCOUNT_ID>` (팀 운영 채널) |
| Region | `ap-northeast-2` |
| 운영 버킷 | `<S3_PROD_BUCKET>` (팀 운영 채널) |
| 객체 경로 | `workspaces/{workspaceId}/datasets/{datasetKey}/{uuid}_{filename}` |
| 라이프사이클 | 0일 → `INTELLIGENT_TIERING`, 비완료 멀티파트 7일 Abort, 비현재 버전 90일 후 삭제 |
| 기본 암호화 | SSE-S3 (AES256) |
| 버킷 정책 | `aws:SecureTransport=false` 거부, 미암호화 PutObject 거부 |
| Public Access | 전부 차단 |
| Object Ownership | `BucketOwnerEnforced` (ACL 비활성) |
| 버저닝 | Enabled |
| IAM 정책 | `ostone-s3-rw` — 버킷·prefix 한정 List/Put/Get/Delete/AbortMultipartUpload |
| IAM user | `ostone-backend` — `ostone-s3-rw` 첨부, access key 90일 회전 |

### 9.2 Render 환경변수 (Backend)

Render Dashboard → Backend → Environment 에서 다음을 추가한다. **시크릿은 git 에 절대 커밋하지 않는다.**

| 변수 | 값 |
| --- | --- |
| `STORAGE_S3_BUCKET` | `<S3_PROD_BUCKET>` |
| `STORAGE_S3_REGION` | `ap-northeast-2` |
| `STORAGE_S3_ENDPOINT` | (빈 값) |
| `STORAGE_S3_PATH_STYLE` | `false` |
| `STORAGE_S3_ACCESS_KEY` | (IAM user `ostone-backend` 의 Access Key ID) |
| `STORAGE_S3_SECRET_KEY` | (IAM user `ostone-backend` 의 Secret Access Key) |

`render.yaml` 에는 이들 키를 정의하지 않는다 — 시크릿이라 Render UI 에서만 관리한다.

### 9.3 비용/이상 사용 가드

| 항목 | 설정 |
| --- | --- |
| AWS Budget `ostone-s3-monthly` | 월 $20, 임계치 50/80/100%, 알림 메일 1건 |
| Cost Anomaly Monitor `ostone-cost-anomaly` | AWS Services 모니터 + S3 dimension, 일별 메일 구독 |
| S3 Storage Lens | 무료 dashboard 활성, 추가 비용 없음 |

### 9.4 로컬에서 실제 운영 버킷 접근

브라우저 SSO 프로필을 통해 가능. 설정 절차는 [`aws-sso-setup.md`](aws-sso-setup.md) 참조. 운영 데이터를 다룰 때는 read-only 작업 위주로 진행한다.

### 9.5 자격증명 회전

- `ostone-backend` 의 access key 는 90일 주기 회전. 회전 절차:
  1. 새 key 발급(기존 key 와 공존 허용)
  2. Render Dashboard 에 새 key 반영, 서비스 재배포
  3. CloudTrail 에서 구 key 사용 0 확인 후 구 key 비활성화 → 삭제
- SSO 세션은 사용자 단위로 8시간 전후 만료, `aws sso login` 재실행으로 갱신.

## 10. FAQ

### Q: Render API Key를 재발급해야 합니다

현재 배포 구조에서는 Render API Key를 GitHub Actions CD 용도로 사용하지 않는다. 별도의 운영 자동화 스크립트를 추가하지 않는 한, 이 문서 기준으로는 GitHub Secrets 업데이트 작업이 필요 없다.

### Q: Neon에서 새 브랜치를 만들 수 있나요

Neon은 데이터베이스 브랜치를 지원하지만, 현재 시스템은 단일 DB만 사용한다. 브랜치별 DB가 필요하면 `application-{profile}.yml`을 추가하고 Render에서 별도 서비스 생성.

### Q: Render 로그는 어디서 확인하나요

1. Render Dashboard → 서비스 선택 → Logs 탭
2. 실시간 로그 스트림 확인
3. 과거 로그는 "Previous Deployments"에서 선택

### Q: GitHub 커밋/PR에서 배포 상태는 어디서 확인하나요

이제 배포는 GitHub Actions CD가 아니라 Render 네이티브 연동이 담당하므로, 기본 확인 위치는 GitHub PR 타임라인이 아니라 Render 대시보드다. 서비스별 Deploy 로그와 배포 이력은 Render Dashboard에서 확인하고, GitHub에서는 CI 결과만 확인하면 된다.
