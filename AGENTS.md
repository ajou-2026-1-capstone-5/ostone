# Agent Context: 상담 로그 기반 CS 워크플로우 생성 시스템

## 프로젝트 개요

**상담 로그 기반 CS 워크플로우 생성 시스템**은 기존 고객상담 로그 데이터를 분석하여 자동으로 CS 워크플로우를 생성하는 AI 기반 시스템이다. 실시간 챗봇보다는 상담 로그에서 운영 지식을 추출하고 이를 실행 가능한 도메인 팩(Domain Pack)으로 전환하는 것이 핵심 목표다.

---

## 기술 스택

| 영역                   | 기술           | 버전   |
| ---------------------- | -------------- | ------ |
| Backend                | Spring Boot    | 3.4.5  |
| Frontend               | Vite+          | 0.1.15 |
| ML Pipeline            | uv Python      | 3.13+  |
| Database               | PostgreSQL     | 16+    |
| Workflow Orchestration | Apache Airflow | 3.2.0  |
| Infrastructure         | Docker Compose | -      |

---

## 모듈 구조

### backend/ — Spring Boot DDD 모듈형 모놀리스

```
backend/
├── auth/                 # 인증/인가, JWT 토큰 관리, 리프레시 토큰
├── workspace/            # 워크스페이스 CRUD, 멤버십 기반 접근 제어
├── domain-pack/          # Domain Pack 관리 (intent, slot, policy, risk, workflow)
│   ├── presentation/     # Controller, DTO, WebSocket Handler
│   ├── application/      # UseCase, Application Service
│   ├── domain/           # Aggregate, Entity, Value Object, Domain Event
│   └── infrastructure/   # JPA Repository, External Client, Config
├── review/               # AI 초안 검토 및 승인
├── pipeline-job/         # Airflow 연동 및 파이프라인 상태 관리
├── workflow-runtime/     # Workflow 실행 및 상태 관리
├── chat-demo/            # 데모용 채팅 세션
├── shared/               # 공통 기술 요소
└── infra/                # 인프라 설정
```

**계층 구조**: `presentation → application → domain → infrastructure`

**8개 Bounded Context**:

1. **auth**: 인증/인가, JWT 토큰 관리, 리프레시 토큰
2. **workspace**: 워크스페이스 생성/조회/수정/보관, 멤버십 기반 접근 제어
3. **domain-pack**: intent/slot/policy/risk/workflow 버전 관리
4. **review**: AI 초안 검토, 수정, 승인, 반려
5. **pipeline-job**: Airflow 파이프라인 실행 요청 및 상태 추적
6. **workflow-runtime**: publish된 domain pack 실행
7. **chat-demo**: 시연용 채팅 세션
8. **shared/infra**: 공통 기술 요소

### frontend/ — Vite+ FSD (Feature-Sliced Design)

```
frontend/
├── src/
│   ├── widgets/          # 독립적인 UI 위젯
│   ├── features/         # 사용자 시나리오 단위 기능
│   ├── entities/         # 비즈니스 엔티티
│   ├── shared/           # 공유 컴포넌트, 유틸리티
│   └── app/              # 앱 초기화, 라우팅
├── public/
└── vite.config.ts
```

**주요 화면 모듈**:

- domain pack 목록/상세
- review 작업 화면
- pipeline 실행/상태 화면
- chat demo 화면

### ml/ — Python Pipeline DAG 기반

```
ml/
├── src/
│   ├── dags/             # Airflow runtime DAG 엔트리
│   └── pipeline/
│       ├── stages/       # 파이프라인 단계 구현
│       └── common/       # 공통 유틸리티/설정
├── tests/
│   └── dags/             # 개발/검증 전용 DAG
└── pyproject.toml
```

**8개 Pipeline Stage**:

1. **ingestion**: 상담 로그 입력, conversation 단위 묶기
2. **preprocessing**: boilerplate 제거, canonical text 생성, PII 제거
3. **representation**: role-aware semantic representation과 flow signature 생성
4. **intent-discovery**: semantic embedding, graph clustering
5. **flow-splitting**: semantic cluster를 workflow entry point 단위로 분할
6. **draft-generation**: slot/policy/risk/workflow 초안 생성
7. **evaluation**: mapping rate, outlier rate, workflow separability 평가
8. **publish-candidate**: 최종 draft artifact 생성 및 Spring 전달

---

## 아키텍처 요약

시스템은 '제품 런타임 계층(Spring Backend + Frontend)'과 '도메인 팩 생성 계층(Airflow + Python Pipeline)' 두 축으로 구성된다. 제품 런타임 계층은 운영자 UI, 검토/승인, 채팅 데모를 제공하고 도메인 팩을 관리한다. 도메인 팩 생성 계층은 오프라인 파이프라인을 통해 상담 로그에서 운영 지식을 추출하고 실행 가능한 도메인 팩으로 전환한다. 상세 아키텍처는 `.agent/docs/architecture.md` 참조.

---

## DB 스키마 개요

**6개 PostgreSQL Schema**:

| Schema     | 목적                 | 주요 테이블                                                                               |
| ---------- | -------------------- | ----------------------------------------------------------------------------------------- |
| `app`      | 워크스페이스, 사용자 | workspace, app_user, workspace_member                                                     |
| `corpus`   | 상담 로그            | dataset, conversation, conversation_turn                                                  |
| `pack`     | Domain Pack          | domain_pack, domain_pack_version, intent_definition, slot_definition, workflow_definition |
| `review`   | 검토/승인            | review_session, review_task, review_decision                                              |
| `pipeline` | 파이프라인           | pipeline_job, pipeline_artifact, evaluation_run                                           |
| `runtime`  | 실행 기록            | chat_session, workflow_execution, decision_log                                            |

---

## 문서 구조

```
.agent/
├── docs/
│   ├── architecture.md   # 전체 시스템 아키텍처
│   ├── schema.md         # PostgreSQL 스키마 정의
│   └── deployment.md     # AWS ECS/S3/CloudFront 배포 가이드
├── rules/
│   ├── principles.md     # KISS/YAGNI/DRY 등 핵심 원칙
│   ├── java.md           # Java/Spring 코딩 규칙
│   ├── typescript.md     # TypeScript/React 코딩 규칙
│   ├── python.md         # Python/ML 코딩 규칙
│   ├── git.md            # Git 워크플로우 및 커밋 규칙
│   ├── code-review.md    # 코드 리뷰 가이드라인
│   ├── error-handling.md # 에러 핸들링 패턴
│   ├── module-creation.md # 모듈 생성 가이드
│   └── testing.md        # 테스트 전략
└── specs/
    ├── _TEMPLATE_BE.md   # Backend 스펙 템플릿
    ├── _TEMPLATE_FE.md   # Frontend 스펙 템플릿
    └── _TEMPLATE_ML.md   # ML Pipeline 스펙 템플릿
```

### 스펙 작성 규칙

- 스펙 문서는 **완벽하게 실행 가능한 코드**를 목표로 하지 않는다. 핵심은 요구사항, 구조, 의도, 검증 기준을 명확하게 남기는 것이다.
- 예시 코드나 의사 코드는 불완전해도 되지만, 실제 파일/모듈/문서 경로를 참조할 때는 해당 경로가 **실제로 존재하는지 먼저 엄격하게 확인**한다.
- 존재를 확인하지 못한 외부 경로는 추정해서 적지 않는다. 필요하면 `미확인 경로`로 명시하거나 확인 가능한 상위 경로 수준으로만 서술한다.

---

## COMMANDS

### Docker Compose

**로컬 개발 진입점**: `docker compose up -d` 한 번으로 FE(`http://localhost:5173`) / BE(`http://localhost:8080`) / MinIO 콘솔(`http://localhost:9001`) / Airflow(`http://localhost:8081`) 가 전부 구동된다. **호스트에서 별도로 `pnpm dev` 를 띄울 필요 없다** — frontend 는 Vite dev server 가 컨테이너 안에서 5173 으로 실행되며 `./frontend` 디렉터리는 volume mount 되어 HMR 이 즉시 반영된다.

**포트 컨벤션**: `5173` = 로컬 개발 (Vite dev server, `frontend/Dockerfile.dev`). `3000` = production 이미지 내부 nginx 포트 (`frontend/Dockerfile`). 로컬에서 3000 으로 접근할 일은 없다.

```bash
# 최초 1회 env 파일 준비
cp .env.example .env

# backend 컨테이너 사용 시 선행 빌드 (jar 패키징 필요)
(cd backend && ./gradlew bootJar)

# 전체 서비스 실행 (frontend 는 컨테이너 안에서 pnpm install + dev server 구동)
docker compose up -d

# 개별 서비스
docker compose up -d postgres
docker compose up -d backend
docker compose up -d frontend
docker compose up -d airflow-init airflow-apiserver airflow-scheduler airflow-dag-processor

# 로그 확인
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f airflow-apiserver
```

기본 원칙:

- Airflow 로컬 런타임은 루트 `docker compose` 기준으로 함께 관리한다.
- `backend` 이미지는 선행 `bootJar` 빌드를 전제한다. `frontend` 는 dev mode 라 선행 빌드 불필요.
- Dockerfile이나 의존성 변경을 강제로 다시 반영할 때만 `docker compose up --build -d`를 사용한다.
- production frontend 이미지를 로컬에서 검증할 때만 `docker build -f frontend/Dockerfile -t init-frontend-prod ./frontend` 로 별도 빌드한다 (compose 와 무관).

### Backend (Gradle)

| 목적            | 커맨드                                    |
| --------------- | ----------------------------------------- |
| 빌드            | `./gradlew build`                         |
| 빠른 H2 테스트  | `./gradlew test` 또는 `./gradlew testH2`  |
| PostgreSQL 테스트 | `./gradlew testPg`                      |
| 실행            | `./gradlew bootRun`                       |
| JAR 패키징      | `./gradlew bootJar`                       |
| 코드 포맷팅     | `./gradlew spotlessApply`                 |
| 체크스타일 검사 | `./gradlew checkstyleMain checkstyleTest` |
| 전체 검사       | `./gradlew check`                         |

**프로필** (env: `SPRING_PROFILES_ACTIVE=local`):

- `default`: PostgreSQL + Liquibase
- `local`: SQL 로깅 활성화 (`application-local.yml`)
- `test`: 기본 테스트 리소스 기준 H2 인메모리 + Liquibase 비활성화

**테스트 DB 전략**:

- `./gradlew test`와 `./gradlew testH2`는 빠른 단위/슬라이스 검증용 기본 경로이며, `backend/src/test/resources/application.yml`의 H2 인메모리 DB와 Hibernate `create-drop`을 사용하고 Liquibase를 비활성화한다.
- `./gradlew testPg`는 통합/CI 재현용 경로이며, PostgreSQL에 연결하고 Liquibase를 활성화한 뒤 Hibernate `ddl-auto=validate`로 검증한다. 기본 연결값은 `jdbc:postgresql://localhost:5432/testdb`, `postgres/postgres`이며 필요하면 `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`로 덮어쓴다.
- CI backend job은 `pgvector/pgvector:pg16` 서비스를 띄우고 `CREATE EXTENSION IF NOT EXISTS vector;`를 적용한 뒤 `./gradlew testPg build -x test -x checkstyleMain -x checkstyleTest`를 실행한다. CI 실패를 로컬에서 같은 조건으로 재현하려면 동일한 PostgreSQL/pgvector DB를 준비한 뒤 `./gradlew testPg`를 실행한다.

```bash
docker run --rm --name ostone-test-pg -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=testdb -p 5432:5432 -d pgvector/pgvector:pg16
docker exec ostone-test-pg psql -U postgres -d testdb -c "CREATE EXTENSION IF NOT EXISTS vector;"
(cd backend && ./gradlew testPg)
```

### Frontend (pnpm)

| 목적      | 커맨드         |
| --------- | -------------- |
| 개발 서버 | `pnpm dev`     |
| 빌드      | `pnpm build`   |
| 테스트    | `pnpm test`    |
| 린트      | `pnpm lint`    |
| 포맷      | `pnpm format`  |
| 미리보기  | `pnpm preview` |

**Vite+ 플러그인**: `vp` 커맨드 사용 (dev/build/test/fmt)

### ML Pipeline (uv)

| 목적          | 커맨드                                                                          |
| ------------- | ------------------------------------------------------------------------------- |
| 의존성 동기화 | `cd ml && uv sync`                                                              |
| 테스트        | `cd ml && uv run pytest`                                                        |
| Lint          | `cd ml && uv run ruff check .`                                                  |
| 포맷          | `cd ml && uv run ruff format .`                                                 |
| 타입 검사     | `cd ml && uv run mypy .`                                                        |
| 전체 검사     | `cd ml && uv run ruff check . && uv run ruff format --check . && uv run mypy .` |

**참고**: Airflow 로컬 런타임 관련 구성은 `ml/airflow/`, `ml/src/dags/`, 루트 `docker-compose.yml` 기준으로 관리한다.

### Root Scripts

| 목적        | 커맨드             |
| ----------- | ------------------ |
| 의존성 설치 | `pnpm install`     |
| Husky 설치  | `pnpm run prepare` |
| 전체 포맷   | `pnpm run format`  |

---

## NOTES

### Pre-commit Hooks

```
.husky/
├── pre-commit    # pnpm exec lint-staged
└── commit-msg   # pnpm exec commitlint --edit
```

**lint-staged 설정** (`lint-staged.config.js`):

| 패턴                     | 실행 작업                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `backend/**/*.java`      | `cd backend && ./gradlew spotlessCheck`                                                 |
| `frontend/**/*.{ts,tsx}` | `cd frontend && pnpm run lint` → `cd frontend && pnpm run format`                       |
| `ml/**/*.py`             | `cd ml && uv run ruff check` → `cd ml && uv run ruff format` → `cd ml && uv run mypy .` |

### CI/CD

**paths-filter**: 변경 파일에 따라 관련 모듈만 빌드/테스트

```yaml
backend: # ./gradlew build (checkstyle 스킵)
frontend: # pnpm install --frozen-lockfile && pnpm test && pnpm build
ml: # uv sync && uv run pytest
```

**Gotchas**:

- CI: `./gradlew testPg build -x test -x checkstyleMain -x checkstyleTest` (PostgreSQL/Liquibase 테스트 + 체크스타일 스킵)
  - 실제 빌드 영향 없음, CI 속도 최적화를 위한 건너뛰기
  - 로컬에서는 `./gradlew check`로 전체 검사 권장
- 기본 테스트: H2 인메모리 (`jdbc:h2:mem:testdb`) 사용, Liquibase 비활성화
- CI 재현 테스트: `./gradlew testPg`로 PostgreSQL + Liquibase 활성화 조건 사용
- CORS 기본 허용: `http://localhost:5173` (프론트 개발 서버)

### Docker 이미지 빌드

```bash
# Backend
cd backend && ./gradlew bootJar && docker build -t init-backend .

# Frontend
cd frontend && pnpm build && docker build -t init-frontend .
```

### 환경 변수

| 변수                                    | 설명                 | 기본값                |
| --------------------------------------- | -------------------- | --------------------- |
| `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | PostgreSQL 연결 정보 | `init`                |
| `SPRING_PROFILES_ACTIVE`                | Spring 프로필        | `local`               |
| `JWT_SECRET`                            | JWT 서명 키          | (필수)                |
| `CORS_ALLOWED_ORIGINS`                  | CORS 허용 오리진     | `http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176` |

---

## CONVENTIONS & ANTI-PATTERNS

### 공통 원칙

- **KISS**: 가장 단순한 해결책 먼저. "나중에 필요할 수도 있으니까"는 추가 이유가 아님
- **YAGNI**: 실제로 필요한 기능만 구현
- **DRY**: 중복 허용 안 함, 3번 반복 시 추출
- **Rule of Three**: 복잡한 추상화는 3번 반복 후 도입
- **불필요한 주석 금지**: 코드·설정 자체로 드러나는 내용이나 일시적 맥락을 장황하게 남기지 않음. 비자명한 제약, 장애 재발 방지 근거, 운영상 주의점처럼 유지보수에 필요한 경우에만 간결하게 작성

### Backend (Java/Spring)

**금지 패턴**:

- **도메인 엔티티 public setter**: 상태 변경은 의미 있는 도메인 메서드로만 (`close()`, `publish()` 등)
- **@Autowired 필드 주입**: 생성자 주입 + final 필드 필수
- **Controller 비즈니스 로직**: Service에 위임, Controller는 HTTP 처리만
- **JPA 엔티티 직접 반환**: DTO 변환 필수 (lazy loading, 순환 참조 방지)
- **일반 Exception catch**: 구체적 예외 사용 (`GlobalExceptionHandler` fallback 제외)
- **빈 catch 블록**: 최소 로깅 필요
- **과도한 Javadoc**: 비자명한 동작에만 간결하게

**권장 패턴**:

- 클래스 레벨 `@Transactional(readOnly = true)` 기본값, 쓰기 메서드만 개별 오버라이드
- BusinessException 계층 구조: `NotFoundException`, `DuplicateException`, `BadRequestException` 등
- Command/Result 객체로 서비스 메서드 파라미터/반환 정리

**계층 의존성 방향** (DDD):

```
presentation → application → domain ← infrastructure
```

### Frontend (TypeScript/React)

**FSD 의존성 방향** (상위 → 하위만 허용):

```
app → pages → widgets → features → entities → shared
```

**금지 패턴**:

- **shared → features/entities import**: shared는 하위 계층이므로 상위 import 불가
- **feature 간 cross-slice import**: 같은 계층 cross-slice 금지
- **entities → features import**: entities는 하위 계층
- **alert() 사용**: UX 저하, Toast/Notification 컴포넌트 사용 필수

**권장 패턴**:

- 프론트엔드에서 **디자인/UI/스타일링 작업을 시작하기 전에 반드시 `frontend/DESIGN.md`를 먼저 읽고 준수한다**
- `frontend/DESIGN.md`의 타이포그래피, 색상, radius, focus outline, 반응형 규칙을 임의 해석으로 대체하지 않는다
- 디자인 가이드와 구현 사이에 충돌이 있으면 기존 UI 관성보다 `frontend/DESIGN.md`를 우선 기준으로 삼는다
- Backend HTTP API 호출은 `frontend/src/shared/api/generated/`의 Orval generated endpoint function/hook을 기본값으로 사용한다
- `apiClient` 또는 `customFetch` 직접 호출은 generated에 없는 endpoint에만 허용하며, 해당 파일에 OpenAPI 미생성 endpoint임을 명시한다
- feature/entity API wrapper는 unwrap/select, query key 표준화, toast/error mapping, optimistic update, response normalization 목적일 때만 둔다
- generated 파일은 직접 수정하지 않고 backend OpenAPI 갱신 후 `cd frontend && pnpm api:gen`으로 재생성한다
- 컴포넌트당 단일 책임
- loading/error/empty 3종 세트 처리 필수
- API 에러는 toast.error() 사용
- React ErrorBoundary로 렌더링 에러 포착

### ML (Python)

**파이프라인 구조**: ML Runtime v2는 8개 Stage 순서 강제

```
ingestion → preprocessing → representation → intent_discovery → flow_splitting → draft_generation → evaluation → publish_candidate
```

**파이프라인 규칙**:

- 각 Stage는 독립적 DAG 태스크로 구현
- Stage 간 데이터는 artifact(JSON/Parquet)로 전달
- PII 제거는 preprocessing Stage에서 필수
- `dev_bootstrap`, `dev_replay`는 `ml/tests/dags/`에서 관리하는 smoke/retry 검증용 예외 DAG다

### Git 워크플로우

**브랜치 패턴**:

> **중요**: 이 저장소에서는 일반 Codex 기본 브랜치 접두어인 `codex/`를 사용하지 않는다.
> GitHub Issue 기반 작업은 아래 표의 `feature/{번호}-{설명}` 또는 `fix/{번호}-{설명}` 패턴을 반드시 따른다.
> 이슈 라벨/성격이 `enhancement`, 기능 보강, UX 개선이면 `feature/*`를 사용하고, 명확한 결함 수정이면 `fix/*`를 사용한다.
> PR 생성 전 현재 브랜치명이 이 표와 맞는지 확인하고, 맞지 않으면 규칙에 맞는 브랜치로 새로 push한 뒤 PR을 연다.

| 용도        | 패턴                    | 스펙 필요      |
| ----------- | ----------------------- | -------------- |
| 스펙 작성   | `spec/{번호}`           | 아니오         |
| 기능 구현   | `feature/{번호}-{설명}` | 예             |
| 버그 수정   | `fix/{번호}-{설명}`     | 예             |
| 인프라/잡일 | `chore/{설명}`          | 아니오         |
| 문서        | `docs/{설명}`           | 아니오         |
| main        | 보호                    | 직접 push 금지 |

**이슈 관리 규칙**:

- `fix/*` 작업은 Burndown Studio가 아니라 **GitHub Issue**에 등록하고 관리한다.

**커밋 형식**: Conventional Commits

```
type(scope): subject
예: feat(domain-pack): add publish endpoint
```

**SemVer 매핑**:

- `feat` → minor (0.X.0)
- `fix`, `perf` → patch (0.0.X)
- `feat!` → major (X.0.0)
- `docs`, `style`, `refactor`, `test`, `chore` → 변화 없음

### CI/CD

**paths-filter**: 변경 파일에 따라 관련 모듈만 빌드/테스트

- `feature/*`, `fix/*`, `spec/*` → 스펙 파일 필수 검증
- `chore/*`, `docs/*` → 스펙 불필요
- `main` → 직접 push 금지

**스펙 파일명 규칙**:

- 스펙 파일 경로: `.agent/specs/{이슈번호}.md`
- CI `spec-check`가 정확히 `.agent/specs/${ISSUE_NUM}.md` 파일을 찾으므로, 파일명은 **반드시 이슈 번호만** 포함해야 한다.
- ✅ 올바른 예: `.agent/specs/4.1.3.md`
- ❌ 잘못된 예: `.agent/specs/4.1.3-demo-runtime-domain-pack-mock.md`
- `spec/{번호}` 브랜치에서 스펙을 작성할 때 파일명을 `{번호}.md`로 생성한다

---

## 참고

- `.agent/rules/`: 상세 코딩 규칙 (principles, java, typescript, python, git, code-review)
- `.agent/docs/architecture.md`: 상세 아키텍처 문서
- `.agent/docs/schema.md`: PostgreSQL 스키마 DDL
- `.agent/docs/deployment.md`: AWS ECS/S3/CloudFront 배포 가이드
- `.sisyphus/plans/`: 프로젝트 계획 문서
