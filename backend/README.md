# INIT Backend

Spring Boot 기반 CS 워크플로우 생성 시스템 백엔드

## 기술 스택

- Java 21
- Spring Boot 3.4.5
- Gradle 9.4.1
- PostgreSQL 16
- Liquibase

## 아키텍처

DDD 기반 모듈형 모놀리스로 설계되었습니다.

### Bounded Context (6개)

| BC | 설명 |
|----|------|
| domain-pack | Domain Pack 관리 (intent, slot, policy, risk, workflow) |
| review | AI 초안 검토 및 승인 |
| pipeline-job | Airflow 연동 및 파이프라인 상태 관리 |
| workflow-runtime | Workflow 실행 및 상태 관리 |
| chat-demo | 데모용 채팅 세션 |
| shared | 공통 기술 요소 |

### 레이어 구조 (각 BC별)

```
presentation/    → Controller, DTO, WebSocket Handler
application/     → UseCase, Application Service
domain/          → Aggregate, Entity, Value Object, Domain Event
infrastructure/  → JPA Repository, External Client, Config
```

## 개발 환경 설정

```bash
# 빌드
./gradlew build

# 테스트
./gradlew test

# 실행
./gradlew bootRun

# 코드 포맷팅
./gradlew spotlessApply

# 체크스타일 검사
./gradlew checkstyleMain
```

## Docker 빌드

```bash
# JAR 빌드 후 Docker 이미지 생성
./gradlew bootJar
docker build -t init-backend .

# 실행
docker run -p 8080:8080 init-backend
```

## 데이터베이스

PostgreSQL 6개 스키마:
- `app`: workspace, user
- `corpus`: 상담 로그
- `pack`: domain pack
- `review`: 검토/승인
- `pipeline`: 파이프라인 job
- `runtime`: 실행 기록

Liquibase로 스키마 관리됩니다.

## 프로필

- `default`: PostgreSQL 연결
- `local`: 로컬 개발용 (SQL 로깅 활성화)
- `test`: 테스트용 (H2 인메모리)
