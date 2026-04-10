# 모듈 생성 가이드

## 개요

새 Bounded Context(모듈) 생성 시 따라야 할 체크리스트. auth 모듈을 참조 구현으로 사용한다.

## 사전 확인

- [ ] 새 모듈이 기존 모듈과 책임이 겹치지 않는가?
- [ ] Bounded Context 이름이 도메인 용어와 일치하는가?
- [ ] AGENTS.md의 Bounded Context 목록에 추가할 준비가 됐는가?

## 디렉토리 구조

```text
backend/src/main/java/com/init/{module}/
├── presentation/       # Controller, DTO, WebSocket Handler
│   ├── {Module}Controller.java
│   ├── dto/
│   │   ├── {Action}Request.java
│   │   └── {Action}Response.java
│   └── package-info.java
├── application/        # UseCase, Application Service
│   ├── {Module}Service.java
│   ├── exception/      # 비즈니스 예외
│   └── package-info.java
├── domain/             # Aggregate, Entity, Value Object
│   ├── model/
│   │   ├── {AggregateRoot}.java
│   │   └── {ValueObject}.java
│   ├── repository/
│   │   └── {Repository}.java  (interface)
│   └── package-info.java
└── infrastructure/     # JPA Repository, External Client
    ├── persistence/
    │   └── Jpa{Repository}.java
    └── package-info.java
```

## 계층별 필수 파일 (체크리스트)

### Domain 계층 (먼저 작성)

- [ ] Aggregate Root 엔티티 (`@Entity`, `@Table(schema="...")`)
- [ ] Repository 인터페이스 (domain 패키지에, JPA 의존성 없이)
- [ ] 도메인 예외 (BusinessException 상속)
- [ ] Value Object (필요시 `@Embeddable`)
- [ ] package-info.java

### Application 계층

- [ ] Service 클래스 (`@Service`, `@Transactional`)
- [ ] 생성자 주입 (final 필드 + 생성자)
- [ ] 도메인 Repository 인터페이스 의존
- [ ] package-info.java

### Presentation 계층

- [ ] Controller (`@RestController`, `@RequestMapping`)
- [ ] Request/Response DTO (record 사용 권장)
- [ ] `@Valid` 어노테이션으로 입력 검증
- [ ] 적절한 HTTP 상태 코드 (201 생성, 204 삭제 등)
- [ ] package-info.java

### Infrastructure 계층

- [ ] JPA Repository 구현 (`JpaRepository<Entity, Long>` 상속)
- [ ] DB 마이그레이션 (Liquibase changeset)
- [ ] package-info.java

## DB 스키마 추가

- [ ] 새 PostgreSQL schema 또는 기존 schema에 테이블 추가
- [ ] Liquibase changeset 작성 (`backend/src/main/resources/db/changelog/`)
- [ ] FK 제약, unique index, check constraint 포함

## 테스트 scaffolding

- [ ] Service 단위 테스트 (`@ExtendWith(MockitoExtension)`)
- [ ] Controller 통합 테스트 (`@WebMvcTest` + MockMvc)
- [ ] 최소 happy path + validation 실패 시나리오

## 문서 업데이트

- [ ] AGENTS.md Bounded Context 목록 업데이트
- [ ] 필요시 `.agent/docs/schema.md` 업데이트

## 참조 구현

### auth 모듈 (완성된 모범 사례)

```text
backend/src/main/java/com/init/auth/
├── presentation/
│   ├── AuthController.java (99L) — @Valid, HTTP 상태 코드
│   └── dto/ — 11개 DTO (LoginRequest, LoginResponse 등)
├── application/
│   ├── AuthService.java (212L) — 생성자 주입, @Transactional
│   ├── JwtService.java (98L)
│   ├── exception/ — 6개 예외 클래스
│   └── *Command.java, *Result.java — 6개 Command/Result
├── domain/
│   ├── model/
│   │   ├── AppUser.java (149L) — 도메인 메서드 (initiatePasswordReset)
│   │   ├── RefreshToken.java (83L) — revoke(), isValid()
│   │   ├── UserRole.java
│   │   └── UserStatus.java
│   └── repository/
│       ├── AppUserRepository.java
│       └── RefreshTokenRepository.java
└── infrastructure/
    └── persistence/
        ├── JpaAppUserRepository.java
        └── JpaRefreshTokenRepository.java
```

### domainpack 모듈 (스켈레톤 상태)

```text
backend/src/main/java/com/init/domainpack/
├── presentation/package-info.java (1L)
├── application/package-info.java (1L)
├── domain/package-info.java (6L)
└── infrastructure/package-info.java (1L)
```

→ 새 모듈은 domainpack처럼 package-info.java만 있는 상태에서 시작하여 auth처럼 완성해 나간다.
