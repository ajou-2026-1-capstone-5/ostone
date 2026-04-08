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
| Workflow Orchestration | Apache Airflow | 2.10+  |
| Infrastructure         | Docker Compose | -      |

---

## 모듈 구조

### backend/ — Spring Boot DDD 모듈형 모놀리스

```
backend/
├── auth/                 # 인증/인가, JWT 토큰 관리, 리프레시 토큰
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

**7개 Bounded Context**:

1. **auth**: 인증/인가, JWT 토큰 관리, 리프레시 토큰
2. **domain-pack**: intent/slot/policy/risk/workflow 버전 관리
3. **review**: AI 초안 검토, 수정, 승인, 반려
4. **pipeline-job**: Airflow 파이프라인 실행 요청 및 상태 추적
5. **workflow-runtime**: publish된 domain pack 실행
6. **chat-demo**: 시연용 채팅 세션
7. **shared/infra**: 공통 기술 요소

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

1. **ingestion**: 상담 로그 입력, conversation 단위 묶기, PII 제거
2. **preprocessing**: boilerplate 제거, canonical text 생성
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

## 개발 환경

### Docker Compose

```bash
# 전체 서비스 실행
docker-compose up -d

# 개별 서비스
docker-compose up -d postgres
docker-compose up -d backend
docker-compose up -d frontend
docker-compose up -d airflow-webserver
```

### CI/CD

- **Backend**: Gradle build, JUnit tests, Spotless formatting
- **Frontend**: pnpm build, Vitest, ESLint, Prettier
- **ML**: pytest, black, ruff

### Pre-commit Hooks

- Backend: Spotless (Java formatting)
- Frontend: Prettier, ESLint
- ML: black, ruff

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
│   └── code-review.md    # 코드 리뷰 가이드라인
├── audit/
│   ├── db-schema-compliance-report.md       # DB 스키마 컴플라이언스 리포트
│   └── implementation-compliance-report.md  # 구현 컴플라이언스 리포트
└── specs/
    ├── _TEMPLATE_BE.md   # Backend 스펙 템플릿
    ├── _TEMPLATE_FE.md   # Frontend 스펙 템플릿
    └── _TEMPLATE_ML.md   # ML Pipeline 스펙 템플릿
```

---

## 참고

- `.agent/docs/architecture.md`: 상세 아키텍처 문서
- `.agent/docs/schema.md`: PostgreSQL 스키마 DDL
- `.sisyphus/plans/`: 프로젝트 계획 문서
