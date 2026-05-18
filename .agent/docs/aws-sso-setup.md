# AWS SSO 온보딩 가이드 (ostone)

ostone 백엔드가 로컬에서 실제 AWS S3 버킷에 직접 붙어야 할 때(MinIO 대신), 모든 팀원은 본 가이드대로 AWS IAM Identity Center 프로필을 본인의 머신에 1회 설정한다. 일상적인 로컬 개발은 그대로 MinIO 로 진행해도 무방하며, SSO 프로필은 운영 버킷의 상태 확인·디버깅·일회성 객체 조회 등에 사용된다.

## 0. 사전 정보

| 항목 | 값 |
| --- | --- |
| AWS 계정 ID | `<AWS_ACCOUNT_ID>` (팀 운영 채널에서 확인) |
| Region | `ap-northeast-2` (서울) |
| IAM Identity Center 포털 | `<SSO_PORTAL_URL>` (팀 운영 채널에서 확인) |
| 운영 버킷 | `<S3_PROD_BUCKET>` (팀 운영 채널에서 확인) |

`<AWS_ACCOUNT_ID>`, `<SSO_PORTAL_URL>`, `<S3_PROD_BUCKET>`, 본인의 **Permission Set 이름**(예: `AdministratorAccess`, `DeveloperReadOnly` 등)은 git 에 커밋하지 않는다. 실제 값은 ostone 운영 채널(예: 팀 1Password "ostone AWS" 노트 또는 비공개 Slack 채널)에서 공유받아 본인의 `~/.aws/config` 에만 채워 넣는다.

## 1. AWS CLI v2 설치 확인

```bash
aws --version
# aws-cli/2.x ... 가 떠야 한다. 안 나오면 https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
```

## 2. `~/.aws/config` 에 SSO 프로필 추가

기존에 `aws-api-mcp`(브라우저 로그인) 등 다른 도구가 쓰는 `[default]` 블록이 있어도 그대로 둔다. 본 가이드의 블록은 그 아래에 **추가**만 한다.

```ini
# 기존 블록은 그대로 유지
# [default]
# login_session = arn:aws:iam::<AWS_ACCOUNT_ID>:user/<your-iam-user>
# region = ap-northeast-2

[sso-session ostone]
sso_start_url = <SSO_PORTAL_URL>
sso_region = ap-northeast-2
sso_registration_scopes = sso:account:access

[profile ostone]
sso_session = ostone
sso_account_id = <AWS_ACCOUNT_ID>
sso_role_name = <PermissionSetName>   # 관리자에게 확인한 본인의 Permission Set 이름
region = ap-northeast-2
output = json
```

## 3. 로그인

```bash
aws sso login --profile ostone
# 브라우저가 열림 → AWS SSO 포털에서 로그인 + Approve
# 성공 시 ~/.aws/sso/cache/<hash>.json 에 임시 자격증명 캐시
```

확인:

```bash
aws --profile ostone sts get-caller-identity
# Account: <AWS_ACCOUNT_ID> / Arn: arn:aws:sts::<AWS_ACCOUNT_ID>:assumed-role/AWSReservedSSO_...
```

세션 만료(기본 8시간 전후) 시 위 명령을 다시 실행하면 된다. 운영 작업 중 갑자기 `ExpiredToken` 이 떠도 당황하지 않고 `aws sso login --profile ostone` 만 다시 실행하면 된다.

## 4. 백엔드를 로컬에서 실제 AWS S3 에 붙여 띄우기

`.env` 또는 셸 환경변수에서 `STORAGE_S3_ACCESS_KEY`, `STORAGE_S3_SECRET_KEY`, `STORAGE_S3_ENDPOINT`, `STORAGE_S3_PATH_STYLE` 를 **모두 비운다**. 그러면 [`StorageConfig`](../../backend/src/main/java/com/init/corpus/infrastructure/storage/StorageConfig.java) 의 `DefaultCredentialsProvider` 가 자격증명 체인 → 환경변수 → AWS 프로필 → SSO 세션 순으로 탐색한다.

### 4-a. 호스트에서 직접 `./gradlew bootRun` 으로 띄울 때

호스트 프로세스이므로 `~/.aws/sso/cache/` 에 직접 접근할 수 있다. `AWS_PROFILE` 만 주면 된다.

```bash
AWS_PROFILE=ostone \
  STORAGE_S3_BUCKET=<S3_PROD_BUCKET> \
  STORAGE_S3_REGION=ap-northeast-2 \
  ./gradlew :backend:bootRun -Dspring.profiles.active=local
```

### 4-bis. Docker Compose 로 띄울 때 (권장)

`~/.aws/` 디렉터리를 컨테이너에 마운트하지 않고 SSO 세션을 일회성 환경변수로
주입하는 방식. SSO 토큰이 만료될 때마다 재실행한다.

```bash
aws sso login --profile ostone
eval "$(aws configure export-credentials --profile ostone --format env)"

# 같은 셸에서 (그래야 export 된 AWS_* 가 docker compose 로 전달됨)
docker compose up -d backend
```

`docker-compose.yml` 의 backend 서비스가 `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_REGION` 4 변수를 `${VAR:-}` 형태로 호스트 셸에서 passthrough 받아 컨테이너에 주입한다. 컨테이너 안의 AWS SDK 는 `EnvironmentVariableCredentialsProvider` 로 이 임시 자격증명을 잡아낸다.

토큰 만료(보통 8시간) 시:

```bash
aws sso login --profile ostone
eval "$(aws configure export-credentials --profile ostone --format env)"
docker compose restart backend
```

> 주의: `.env` 의 `STORAGE_S3_ACCESS_KEY` / `STORAGE_S3_SECRET_KEY` / `STORAGE_S3_ENDPOINT` / `STORAGE_S3_PATH_STYLE` 가 모두 빈 값이어야 한다. 한 개라도 값이 있으면 `StaticCredentialsProvider` 가 먼저 잡혀 SSO 자격증명이 무시된다. `.env.example` 의 [모드 B] 블록을 그대로 따르면 안전하다.

> 일반 개발은 그대로 MinIO 사용 ([모드 A]). 본 모드는 운영 데이터 확인 등 특수 목적에만 쓴다.

## 5. 자주 묶이는 문제

- **`Unable to locate credentials`**: `aws sso login --profile ostone` 누락. 위 3번 다시.
- **`Profile ostone does not exist`**: `~/.aws/config` 의 `[profile ostone]` 헤더 오타. 띄어쓰기 1칸 필수.
- **`AccessDenied` on s3:ListBucket**: 본인 Permission Set 이 S3 권한을 포함하는지 관리자에게 확인. 일반적으로 `AdministratorAccess` 면 OK.
- **`ExpiredToken`**: 세션 만료. `aws sso login --profile ostone` 재실행.
- **포털 URL 이 다르다**: 본 문서의 URL 은 ostone 계정 전용. 다른 조직 SSO 와 혼동하지 말 것.

## 6. 운영(Render) 자격증명은 별개

브라우저 SSO 는 사람용이라 Render 서버 런타임에서는 사용할 수 없다. 운영은 별도 IAM user `ostone-backend` 의 access key 를 Render Dashboard 환경변수로 주입한다. 상세는 [`deployment.md`](deployment.md) 의 AWS S3 / IAM 섹션 참조.
