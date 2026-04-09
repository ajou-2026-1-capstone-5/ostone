## Java (Spring Boot)

### 코드 스타일

```java
// 클래스 명명: 명사, PascalCase
public class DomainPackService { }

// 메서드 명명: 동사 + 명사, camelCase
public void publishDomainPack(Long packId) { }

// 변수 명명: camelCase, 의미 있는 이름
private final DomainPackRepository domainPackRepository;

// 상수: UPPER_SNAKE_CASE
public static final int MAX_RETRY_COUNT = 3;
```

### 클래스 구조

```java
// application 계층 서비스는 @Service 어노테이션 사용
@Service
public class DomainPackService {
    private final DomainPackRepository repository;
    private final DomainEventPublisher eventPublisher;

    // 의존성은 생성자 주입
    public DomainPackService(DomainPackRepository repository,
                             DomainEventPublisher eventPublisher) {
        this.repository = repository;
        this.eventPublisher = eventPublisher;
    }

    // 메서드는 한 가지 일만
    public DomainPack publish(Long packId) {
        DomainPack pack = repository.findById(packId)
            .orElseThrow(() -> new NotFoundException("DomainPack not found: " + packId));

        pack.publish();
        repository.save(pack);
        eventPublisher.publish(new DomainPackPublishedEvent(pack));

        return pack;
    }
}
```

### DDD 패턴

```java
// Aggregate Root
@Entity
public class DomainPack {
    @Id
    private Long id;

    @Embedded
    private PackStatus status;

    // Value Object
    @ElementCollection
    private List<IntentDefinition> intents = new ArrayList<>();

    // 도메인 로직은 엔티티 내부에
    public void publish() {
        if (status.isPublished()) {
            throw new IllegalStateException("Already published");
        }
        this.status = PackStatus.PUBLISHED;
    }
}
```

### 계층 규칙

| 계층           | 책임                           | 금지             |
| -------------- | ------------------------------ | ---------------- |
| presentation   | HTTP 요청/응답, DTO 변환       | 비즈니스 로직    |
| application    | 유스케이스 오케스트레이션      | 도메인 규칙 구현 |
| domain         | 비즈니스 규칙, 엔티티, 값 객체 | 외부 의존성      |
| infrastructure | DB, 외부 API, 설정             | 도메인 로직      |

---

## 금지 패턴 (Anti-Patterns)

### 1. 도메인 엔티티에 public setter 금지

```java
// ❌ 금지: 외부에서 상태를 직접 변경
public void setStatus(SessionStatus status) {
    this.status = status;
}

// ✅ 올바름: 의미 있는 도메인 메서드로 상태 변경
public void close() {
    if (this.status == SessionStatus.CLOSED) {
        throw new IllegalStateException("이미 종료된 세션입니다");
    }
    this.status = SessionStatus.CLOSED;
}
```

근거: `backend/src/main/java/com/init/workflowruntime/domain/ChatSession.java` — `setStatus()` public setter가 캡슐화를 위반함. 불변식 보장 불가.

### 2. @Autowired 필드 주입 금지

```java
// ❌ 금지
@Autowired
private UserRepository userRepository;

// ✅ 올바름: 생성자 주입
private final UserRepository userRepository;
public MyService(UserRepository userRepository) {
    this.userRepository = userRepository;
}
```

근거: 필드 주입은 테스트 어려움, 순환 의존 감지 불가, `final` 불가. `backend/src/main/java/com/init/auth/application/AuthService.java` — 생성자 주입 모범 사례.

### 3. Controller에 비즈니스 로직 금지

```java
// ❌ 금지: Controller에서 직접 비즈니스 규칙 판단
@PostMapping
public ResponseEntity<Void> process(@RequestBody Request req) {
    if (req.amount() > 10000) { // 비즈니스 규칙이 Controller에!
        throw new BadRequestException("한도 초과");
    }
    repository.save(new Entity(req));
    return ResponseEntity.ok().build();
}

// ✅ 올바름: Service에 위임
@PostMapping
public ResponseEntity<Void> process(@Valid @RequestBody Request req) {
    service.process(req);
    return ResponseEntity.status(201).build();
}
```

### 4. JPA 엔티티를 API 응답으로 직접 반환 금지

```java
// ❌ 금지: 엔티티 직접 노출
@GetMapping("/{id}")
public AppUser getUser(@PathVariable Long id) {
    return userRepository.findById(id).orElseThrow();
}

// ✅ 올바름: DTO로 변환
@GetMapping("/{id}")
public UserResponse getUser(@PathVariable Long id) {
    AppUser user = service.findById(id);
    return UserResponse.from(user);
}
```

근거: 내부 구조 노출, lazy loading 문제, 순환 참조 발생. `backend/src/main/java/com/init/auth/presentation/dto/` — DTO 변환 모범 사례.

### 5. 일반 Exception catch 금지

```java
// ❌ 금지
try { ... } catch (Exception e) { ... }

// ✅ 올바름: 구체적 예외 사용
try { ... } catch (DataIntegrityViolationException e) {
    throw new DuplicateException("이미 존재하는 항목입니다");
}
```

근거: `backend/src/main/java/com/init/auth/application/AuthService.java:88` — `DataIntegrityViolationException` catch 패턴 참조.

### 6. 빈 catch 블록 금지

```java
// ❌ 금지: 예외 삼키기
try { ... } catch (IOException e) { }

// ✅ 올바름: 최소 로깅
try { ... } catch (IOException e) {
    log.warn("파일 처리 실패", e);
}
```

### 7. 과도한 Javadoc 금지

```java
// ❌ 금지: 자명한 내용을 장황하게 반복
/**
 * 사용자를 ID로 조회합니다.
 * @param id 사용자 ID
 * @return 사용자 엔티티
 * @throws NotFoundException 사용자를 찾을 수 없는 경우
 */
public User findById(Long id) { ... }

// ✅ 올바름: 비자명한 동작에만 간결하게
/** 비밀번호 재설정 토큰은 30분 후 만료된다 */
public void initiatePasswordReset() { ... }
```

근거: `backend/src/main/java/com/init/workflowruntime/application/ConsultationService.java` — 모든 메서드에 자명한 Javadoc이 달려있음. 가독성 저하.

### 8. @Transactional(readOnly=true) 권장 패턴

```java
// ✅ 올바름: 클래스 기본 readOnly=true, 쓰기 메서드만 개별 오버라이드
@Service
@Transactional(readOnly = true)
public class MyService {
    public Thing findById(Long id) { ... }  // readOnly 상속

    @Transactional  // 쓰기 메서드만 개별 오버라이드
    public Thing create(CreateRequest req) { ... }
}
```

근거: 읽기 전용 트랜잭션은 flush skip, dirty checking skip으로 성능 향상.

## 참고

- [Google Java Style Guide](https://google.github.io/styleguide/javaguide.html)
