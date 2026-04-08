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
// 한 클래스는 한 가지 책임만
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

## 참고

- [Google Java Style Guide](https://google.github.io/styleguide/javaguide.html)
