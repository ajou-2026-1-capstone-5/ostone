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

| 변수                | 값                                           | 설명                 |
| ------------------- | -------------------------------------------- | -------------------- |
| `VITE_API_BASE_URL` | `https://ostone-backend.onrender.com/api/v1` | Backend API 전체 URL |

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

## 9. FAQ

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
