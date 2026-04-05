# 상담 로그 기반 CS 워크플로우 생성 시스템 아키텍처 정리

## 1. 문서 목적

이 문서는 현재까지 합의한 시스템 아키텍처를 팀 공유용으로 정리한 문서다.
핵심 목적은 다음 두 가지다.

- 우리가 만들고 있는 시스템의 **제품 구조**와 **생성 파이프라인 구조**를 한 번에 정리한다.
- 이후 상세 설계, API 설계, DB 설계, 화면 설계로 내려갈 때 기준이 되는 **공통 아키텍처 합의안**으로 사용한다.

---

## 2. 문제 정의와 시스템 관점

이 프로젝트의 핵심은 고객응대 챗봇 자체를 만드는 것이 아니다.
기존 상담 로그로부터 고객지원 도메인의 운영 지식을 추출해, 다음과 같은 초안을 자동 생성하는 시스템을 만드는 것이 목적이다.

- intent
- slot
- policy
- risk
- workflow

즉, 실시간으로 답변을 잘하는 챗봇보다, **챗봇이 따라야 할 정책과 처리 흐름을 자동으로 만드는 시스템**에 가깝다.

이 관점에서 보면 시스템은 크게 두 축으로 나뉜다.

- **제품 런타임 계층**
  - 운영자 UI
  - 검토/승인
  - 채팅 데모
  - domain pack 조회 및 적용
- **도메인 팩 생성 계층**
  - 상담 로그 전처리
  - intent discovery
  - slot / policy / risk / workflow 초안 생성
  - 평가 및 publish candidate 생성

---

## 3. 전체 구조 요약

### 한 줄 요약

- Spring Backend는 **domain pack 관리·검토·실행**을 담당한다.
- Airflow + Python Pipeline은 **도메인 팩 생성 파이프라인**을 담당한다.
- Frontend는 운영자 콘솔과 채팅 데모 화면을 제공한다.
- Spring과 Airflow는 **API 호출 + 웹훅** 방식으로 연동한다.

### 전체 구성 요소

- **운영자 웹 콘솔**
  - domain pack 조회, 검토, 승인, 파이프라인 실행 상태 확인
- **고객 채팅 데모 UI**
  - workflow runtime이 어떻게 동작하는지 보여주는 시연용 화면
- **Spring Boot Backend**
  - 제품 런타임 계층의 중심 서버
- **PostgreSQL**
  - domain pack, review, pipeline job 상태, 메타데이터 저장
- **Airflow + Python Pipeline**
  - 상담 로그 기반 domain pack 초안 생성 파이프라인
- **LLM / Inference Layer**
  - 요약, 정규화, 구조화, 라벨링 등에 선택적으로 활용되는 외부 추론 계층

---

## 4. 설계 원칙

### 4.1 아키텍처 원칙

- 제품 런타임과 생성 파이프라인의 책임을 명확히 분리한다.
- Spring Backend는 **제품 도메인 관리**에 집중한다.
- Airflow는 **오프라인 생성 작업의 오케스트레이션**에 집중한다.
- 단일 배포 단위 안에서는 과도한 분산 구조 대신 **모듈형 모놀리스**를 채택한다.
- 내부 설계는 DDD 기준으로 나누되, 실제 구현 가능한 수준에서 bounded context를 제한한다.

### 4.2 도메인 설계 원칙

- 핵심 산출물은 개별 intent나 policy가 아니라 **Domain Pack**이다.
- AI가 생성한 초안은 바로 운영에 쓰지 않고, **사람 검토 루프**를 거쳐 확정한다.
- workflow는 발화 트리가 아니라 **상태 기반 graph**로 본다.
- intent discovery는 semantic similarity뿐 아니라 **workflow equivalence**까지 고려한다.

### 4.3 구현 원칙

- Spring Backend는 **DDD 기반 모듈형 모놀리스**로 구현한다.
- 각 bounded context 내부는 `presentation → application → domain → infrastructure` 계층 구조를 따른다.
- 외부 시스템 연동은 직접 호출 로직을 도메인에 섞지 않고 **adapter / port** 형태로 분리한다.
- long-running job은 동기 요청으로 처리하지 않고 **비동기 요청 + 상태 추적** 구조를 사용한다.

---

## 5. Spring Backend 아키텍처

## 5.1 아키텍처 스타일

Spring Backend는 **DDD 기반 모듈형 모놀리스**로 설계한다.

이 선택의 이유는 다음과 같다.

- 지금 단계에서 MSA는 운영 복잡도가 크다.
- 하지만 단순 controller-service-repository 구조만으로는 domain pack, review, runtime, pipeline 경계가 섞이기 쉽다.
- 따라서 배포는 하나로 유지하되, 내부 코드는 bounded context 단위로 강하게 분리하는 방식이 적절하다.

기본 구조는 다음과 같다.

- `presentation`
  - Controller, WebSocket handler, request/response DTO
- `application`
  - Use case, application service, command/query orchestration
- `domain`
  - Aggregate, entity, value object, domain service, domain event
- `infrastructure`
  - JPA repository implementation, external client, persistence adapter, config

---

## 5.2 bounded context 구성

### 5.2.1 domain-pack

#### 역할

- `intent / slot / policy / risk / workflow` 초안과 확정본을 버전 단위로 관리한다.
- publish 가능한 domain pack 상태를 관리한다.
- 제품 런타임에서 사용할 수 있는 최종 설정 묶음을 제공한다.

#### 주요 Aggregate

- `DomainPack`

#### 주요 내부 요소

- `DomainPackVersion`
- `IntentDefinition`
- `SlotDefinition`
- `PolicyDefinition`
- `RiskDefinition`
- `WorkflowDefinition`
- `PackStatus`

#### 설계 포인트

- 개별 intent를 각각 독립 aggregate로 쪼개기보다, **하나의 domain pack 버전 단위**로 관리하는 것이 지금 프로젝트에 더 맞다.
- 실제 배포/승인/rollback도 pack 단위로 일어나는 구조가 자연스럽다.
- runtime은 publish된 `DomainPack`만 읽도록 경계를 명확히 둔다.

#### 적용 패턴

- Aggregate
- Repository
- Domain Event

---

### 5.2.2 review

#### 역할

- AI가 만든 초안에 대해 사람이 검토, 수정, 승인, 반려를 수행한다.
- 코멘트, 승인 이력, 검토 상태를 기록한다.
- domain pack 품질을 보정하는 human-in-the-loop 루프를 담당한다.

#### 주요 Aggregate

- `ReviewSession`

#### 주요 내부 요소

- `ReviewTask`
- `ReviewComment`
- `ReviewDecision`
- `ReviewStatus`
- `ReviewTargetRef`

#### 설계 포인트

- review는 domain-pack의 부속 기능이 아니라, **독립적인 작업 흐름**을 갖는 bounded context로 본다.
- 같은 domain pack에 대해 여러 검토 task가 열릴 수 있고, 승인/반려/수정 요청 흐름이 별도로 존재할 수 있다.
- review 결과는 domain-pack에 반영되지만, review 자체의 이력과 책임은 별도로 유지한다.

#### 적용 패턴

- Application Service
- Domain Event
- Audit Trail

---

### 5.2.3 pipeline-job

#### 역할

- Airflow 파이프라인 실행을 요청한다.
- 실행 중인 job 상태를 추적한다.
- 웹훅 결과를 수신해 후속 처리를 수행한다.
- 생성된 draft artifact를 domain-pack / review 흐름으로 연결한다.

#### 주요 Aggregate

- `PipelineJob`

#### 주요 내부 요소

- `PipelineRunRef`
- `JobStatus`
- `PipelineResultRef`
- `WebhookReceipt`
- `JobTriggerSource`

#### 설계 포인트

- Spring과 Airflow의 경계는 이 bounded context에서 담당한다.
- 외부 시스템의 run id, callback payload, 상태 변경 이벤트를 여기서 흡수하고 내부 모델로 번역한다.
- domain 쪽이 Airflow 개념에 오염되지 않도록 **경계 번역 레이어** 역할을 한다.

#### 적용 패턴

- Adapter
- Anti-Corruption Layer
- Asynchronous Request-Reply

---

### 5.2.4 workflow-runtime

#### 역할

- publish된 domain pack을 읽어 현재 대화 상태를 해석한다.
- 필요한 slot, policy check, risk check를 수행한다.
- 다음 action을 결정하고 answer / handoff 흐름을 제어한다.

#### 주요 Aggregate

- `WorkflowExecution`

#### 주요 내부 요소

- `ConversationState`
- `SlotState`
- `ConversationIntent`
- `PolicyCheckResult`
- `RiskCheckResult`
- `NextAction`
- `ExecutionStatus`

#### 설계 포인트

- workflow는 발화 트리가 아니라 **상태 기반 graph 실행**으로 본다.
- 따라서 runtime aggregate는 "현재 대화 세션의 실행 상태"를 중심으로 둔다.
- rule evaluation과 next action 결정은 application service에 몰아넣기보다, 상태 전이 규칙과 decision strategy를 분리하는 편이 좋다.

#### 적용 패턴

- State Machine
- Strategy
- Domain Service

---

### 5.2.5 chat-demo

#### 역할

- 데모용 채팅 세션을 관리한다.
- 메시지 기록과 WebSocket 이벤트를 처리한다.
- workflow-runtime의 결과를 사용자 화면에 반영한다.

#### 주요 Aggregate

- `ChatSession`

#### 주요 내부 요소

- `ChatMessage`
- `Participant`
- `MessageRole`
- `SessionStatus`

#### 설계 포인트

- 이 영역은 핵심 도메인이라기보다 **시연용 지원 도메인**에 가깝다.
- 다만 캡스톤 데모에서 중요한 사용자 접점이므로 독립 bounded context로 두는 것이 관리하기 쉽다.
- chat-demo는 답변 생성기라기보다, workflow-runtime의 동작을 시각화하는 프런트 접점이다.

#### 적용 패턴

- Publisher-Subscriber
- WebSocket Session Handler

---

### 5.2.6 shared / infra

#### 역할

- 공통 기술 요소를 제공한다.
- 인증, 예외 처리, 공통 응답, 설정, DB 접근 공통화 등을 담당한다.

#### 주요 요소

- 공통 예외 처리기
- 공통 응답 포맷
- JPA 설정
- WebSocket 설정
- 공통 이벤트 처리
- 보안/인증 설정

#### 설계 포인트

- shared는 도메인 지식을 담는 곳이 아니라, 중복을 줄이기 위한 기술 공통 계층이다.
- 도메인 로직이 shared로 새어 나오지 않도록 주의한다.

#### 적용 패턴

- Shared Kernel
- Infrastructure Service

---

## 6. Spring Backend 내부 패키지 예시

아래처럼 큰 틀의 패키지 구조를 잡을 수 있다.

```text
backend/
  domain-pack/
    presentation/
    application/
    domain/
    infrastructure/
  review/
    presentation/
    application/
    domain/
    infrastructure/
  pipeline-job/
    presentation/
    application/
    domain/
    infrastructure/
  workflow-runtime/
    presentation/
    application/
    domain/
    infrastructure/
  chat-demo/
    presentation/
    application/
    domain/
    infrastructure/
  shared/
  infra/
```

이 구조의 장점은 다음과 같다.

- 모듈 경계가 비교적 명확하다.
- 팀원별 역할 분담이 쉽다.
- 나중에 특정 bounded context만 분리해야 할 때도 이동 경계가 분명하다.

---

## 7. Airflow + Python Pipeline 아키텍처

## 7.1 아키텍처 스타일

Airflow는 실시간 채팅 처리 엔진이 아니라, **도메인 팩 생성용 오프라인 파이프라인 오케스트레이터**로 사용한다.

여기서는 DDD보다 **DAG 기반 파이프라인 아키텍처**가 더 적합하다.

그 이유는 다음과 같다.

- Airflow의 주 책임은 장시간 실행되는 task orchestration이다.
- Python 기반 ML 코드와 산출물 중심의 stage 구성이 핵심이다.
- 여기서 중요한 것은 aggregate보다 **task, artifact, stage boundary**다.

즉, Spring은 도메인 상태와 제품 기능을 관리하고, Airflow는 데이터 산출 파이프라인을 관리하는 구조로 역할을 분리한다.

---

## 7.2 주요 파이프라인 단계

### 7.2.1 ingestion

#### 역할

- 상담 로그 입력
- conversation 단위 묶기
- speaker role 정리
- 비식별화 / 개인정보 제거

#### 주요 산출물

- normalized conversation dataset

---

### 7.2.2 preprocessing

#### 역할

- boilerplate 제거
- canonical text 생성
- role-aware representation 생성
- 실험용 입력 포맷 정리

#### 주요 산출물

- cleaned conversations
- canonical conversation text
- feature-ready dataset

---

### 7.2.3 intent-discovery

#### 역할

- semantic embedding 생성
- graph community detection 수행
- flow signature 생성
- semantic + flow hybrid clustering 수행

#### 주요 기술 후보

- dense embedding
- HDBSCAN
- Leiden / graph community detection
- flow feature extraction
- hybrid clustering

#### 주요 산출물

- intent cluster candidate
- exemplar set
- outlier set
- cluster interpretation input

---

### 7.2.4 draft-generation

#### 역할

- intent별 slot / policy / risk / workflow 초안 생성
- intent card 또는 draft artifact 생성
- review 가능한 구조로 정리

#### 주요 산출물

- draft domain pack
- intent cards
- workflow draft

---

### 7.2.5 evaluation

#### 역할

- mapping rate 평가
- outlier rate 평가
- workflow separability 평가
- merge/split effort 측정

#### 주요 산출물

- evaluation report
- quality score summary
- review priority suggestion

---

### 7.2.6 publish-candidate

#### 역할

- 검토 가능한 최종 draft artifact 생성
- Spring Backend로 결과 전달
- review 작업 생성 가능한 형태로 정리

#### 주요 산출물

- publish candidate artifact
- pipeline result payload

---

## 7.3 Airflow 설계 포인트

- Airflow는 task 간 실행 순서와 상태를 관리한다.
- 실제 의미 있는 비즈니스 산출물은 Python ML 코드와 생성 artifact에서 나온다.
- task를 너무 잘게 쪼개면 운영 복잡도가 올라가므로, **산출물 경계가 바뀌는 지점** 기준으로 stage를 나누는 것이 좋다.
- 파이프라인 결과는 최종적으로 Spring이 이해할 수 있는 구조체 또는 artifact reference로 전달되어야 한다.

### 적용 패턴

- DAG 기반 Task Orchestration
- Artifact-driven Processing
- Stage-based Pipeline

---

## 8. Spring ↔ Airflow 연동 구조

## 8.1 기본 연동 방식

두 계층은 **API 호출 + 웹훅** 방식으로 연동한다.

### 흐름

1. 운영자 또는 시스템이 Spring Backend에서 파이프라인 실행을 요청한다.
2. Spring Backend는 `PipelineJob`을 생성한다.
3. Spring이 Airflow에 API 호출로 job 실행을 요청한다.
4. Airflow가 오프라인 생성 파이프라인을 수행한다.
5. Airflow가 완료 후 Spring으로 웹훅을 전송한다.
6. Spring은 결과를 수신하고 domain-pack / review 흐름으로 연결한다.

## 8.2 연동 대상

- pipeline job 생성
- 실행 상태 변경
- 결과 artifact 수신
- review 대상 등록

## 8.3 설계 포인트

- 제품 서비스는 long-running job을 직접 기다리지 않는다.
- job 상태와 결과를 분리해 관리한다.
- 외부 시스템 payload는 pipeline-job bounded context에서 내부 모델로 번역한다.
- callback 실패나 중복 수신을 고려해 idempotent 처리 전략이 필요한다.

---

## 9. Frontend 구조

## 9.1 역할

프론트엔드는 운영자 콘솔과 채팅 데모 화면을 제공한다.

### 주요 화면 모듈

- domain pack 목록 / 상세
- review 작업 화면
- pipeline 실행 / 상태 화면
- chat demo 화면

## 9.2 설계 원칙

- 기능 단위 화면 모듈로 분리한다.
- 운영자 기능과 데모 기능의 경계를 화면 수준에서 명확히 둔다.
- 실시간 상태 변경과 채팅 이벤트는 WebSocket으로 반영한다.

## 9.3 적용 패턴

- Feature-based UI Module
- Container / Presenter 분리
- WebSocket Event Subscription

---

## 10. 주요 패턴 요약

### Spring Backend

- DDD
- 모듈형 모놀리스
- Layered Architecture
- Aggregate / Repository
- Domain Event

### Workflow Runtime

- State Machine
- Strategy

### 외부 연동

- Ports & Adapters
- Anti-Corruption Layer
- Webhook Callback

### Airflow Pipeline

- DAG 기반 Task Orchestration
- Artifact-driven Processing
- Stage-based Pipeline

### Frontend

- Feature-based UI Module
- Publisher-Subscriber

---

## 11. 현재 합의된 핵심 결정사항

- Backend 메인은 **Spring Boot + Java**를 사용한다.
- Spring Backend는 **DDD 기반 모듈형 모놀리스**로 설계한다.
- Airflow는 실시간 runtime이 아니라 **도메인 팩 생성용 오프라인 파이프라인**에만 사용한다.
- Spring과 Airflow는 **API 호출 + 웹훅**으로 연동한다.
- domain-pack과 review는 분리된 bounded context로 둔다.
- workflow-runtime은 publish된 domain pack을 읽어 실행 상태를 관리하는 별도 bounded context로 둔다.
- chat-demo는 핵심 도메인과 분리된 시연용 bounded context로 둔다.

---

## 12. 다음에 정하면 좋은 항목

이 문서를 기준으로 다음 단계에서 정리하면 좋은 항목은 아래와 같다.

- 각 bounded context의 상세 유스케이스 목록
- 주요 API 목록과 request / response 초안
- DomainPack, ReviewSession, PipelineJob, WorkflowExecution의 상태 전이 정의
- PostgreSQL 테이블 초안
- Airflow DAG 상세 단계와 artifact 스키마
- Frontend 화면별 사용자 플로우

---

## 13. 최종 요약

현재 아키텍처는 크게 보면 아래와 같이 정리된다.

- **Spring Backend**: domain pack 관리, review, workflow 실행, 채팅 데모를 담당하는 제품 런타임 계층
- **Airflow + Python Pipeline**: 상담 로그를 기반으로 domain pack 초안을 생성하는 오프라인 생성 계층
- **Frontend**: 운영자 콘솔과 채팅 데모 UI 제공
- **연동 방식**: API 호출 + 웹훅

즉, 이 시스템은 하나의 챗봇 서비스라기보다, **상담 로그에서 운영 지식을 추출하고 이를 실행 가능한 domain pack으로 전환하는 고객지원 운영 워크스페이스**로 이해하는 것이 가장 정확하다.
