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
├── dags/                 # Airflow DAG 정의
│   ├── ingestion/        # 상담 로그 입력 및 전처리
│   ├── preprocessing/    # boilerplate 제거, canonical text 생성
│   ├── intent_discovery/ # 의도 클러스터링
│   ├── draft_generation/ # 초안 생성
│   ├── evaluation/       # 품질 평가
│   └── publish_candidate/# 결과 전달
├── src/
│   ├── stages/           # 파이프라인 단계 구현
│   ├── models/           # ML 모델
│   └── utils/            # 공통 유틸리티
├── tests/
└── pyproject.toml
```

**6개 Pipeline Stage**:

1. **ingestion**: 상담 로그 입력, conversation 단위 묶기
2. **preprocessing**: boilerplate 제거, canonical text 생성, PII 제거
3. **intent-discovery**: semantic embedding, graph clustering
4. **draft-generation**: slot/policy/risk/workflow 초안 생성
5. **evaluation**: mapping rate, outlier rate, workflow separability 평가
6. **publish-candidate**: 최종 draft artifact 생성 및 Spring 전달

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
│   └── schema.md         # PostgreSQL 스키마 정의
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

```bash
# 최초 1회 env 파일 준비
cp .env.example .env

# 전체 서비스 실행
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

- 로컬 전체 스택은 `docker compose up -d` 한 번으로 실행 가능해야 한다.
- `backend`와 `frontend` 이미지는 선행 `jar`/`dist` 빌드를 요구하지 않도록 유지한다.
- Dockerfile이나 의존성 변경을 강제로 다시 반영할 때만 `docker compose up --build -d`를 사용한다.

### Backend (Gradle)

| 목적            | 커맨드                                    |
| --------------- | ----------------------------------------- |
| 빌드            | `./gradlew build`                         |
| 테스트          | `./gradlew test`                          |
| 실행            | `./gradlew bootRun`                       |
| JAR 패키징      | `./gradlew bootJar`                       |
| 코드 포맷팅     | `./gradlew spotlessApply`                 |
| 체크스타일 검사 | `./gradlew checkstyleMain checkstyleTest` |
| 전체 검사       | `./gradlew check`                         |

**프로필** (env: `SPRING_PROFILES_ACTIVE=local`):

- `default`: PostgreSQL + Liquibase
- `local`: SQL 로깅 활성화 (`application-local.yml`)
- `test`: H2 인메모리 + Liquibase 비활성화

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

**참고**: Airflow 로컬 런타임 관련 구성은 `ml/airflow/`, `ml/dags/`, 루트 `docker-compose.yml` 기준으로 관리한다.

### Root Scripts

| 목적       | 커맨드            |
| ---------- | ----------------- |
| Husky 설치 | `npm run prepare` |
| 전체 포맷  | `npm run format`  |

---

## NOTES

### Pre-commit Hooks

```
.husky/
├── pre-commit    # npx lint-staged
└── commit-msg   # npx commitlint --edit
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
frontend: # pnpm install && pnpm test && pnpm build
ml: # uv sync && uv run pytest
```

**Gotchas**:

- CI: `./gradlew build -x checkstyleMain -x checkstyleTest` (체크스타일 스킵)
  - 실제 빌드 영향 없음, CI 속도 최적화를 위한 건너뛰기
  - 로컬에서는 `./gradlew check`로 전체 검사 권장
- 테스트: H2 인메모리 (`jdbc:h2:mem:testdb`) 사용, Liquibase 비활성화
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
- 컴포넌트당 단일 책임
- loading/error/empty 3종 세트 처리 필수
- API 에러는 toast.error() 사용
- React ErrorBoundary로 렌더링 에러 포착

### ML (Python)

**파이프라인 구조**: 6개 Stage 순서 강제

```
ingestion → preprocessing → intent_discovery → draft_generation → evaluation → publish_candidate
```

**파이프라인 규칙**:

- 각 Stage는 독립적 DAG 태스크로 구현
- Stage 간 데이터는 artifact(JSON/Parquet)로 전달
- PII 제거는 preprocessing Stage에서 필수
- `dev_bootstrap`, `dev_replay`는 smoke/retry 검증용 예외 DAG로서 6-stage production 체인을 그대로 따르지 않아도 된다

### Git 워크플로우

**브랜치 패턴**:

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

---

## 참고

- `.agent/rules/`: 상세 코딩 규칙 (principles, java, typescript, python, git, code-review)
- `.agent/docs/architecture.md`: 상세 아키텍처 문서
- `.agent/docs/schema.md`: PostgreSQL 스키마 DDL
- `.sisyphus/plans/`: 프로젝트 계획 문서
