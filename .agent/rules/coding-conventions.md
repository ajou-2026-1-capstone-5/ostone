# Coding Conventions

이 프로젝트의 코딩 규칙과 원칙을 정리한 문서다. 모든 코드 작성 시 이 규칙을 따른다.

---

## 핵심 원칙

### KISS (Keep It Simple, Stupid)

- 가장 단순한 해결책을 먼저 시도한다.
- "나중에 필요할 수도 있으니까"는 추가의 이유가 아니다.
- 복잡한 추상화는 3번 반복될 때 도입한다 (Rule of Three).

### YAGNI (You Ain't Gonna Need It)

- 실제로 필요한 기능만 구현한다.
- 예상되는 요구사항에 미리 코드를 작성하지 않는다.
- 실제 병목이 확인된 후에만 최적화한다.

### DRY (Don't Repeat Yourself)

- 중복 코드를 허용하지 않는다.
- 유사한 로직이 3번 이상 반복되면 추출한다.
- 하지만 강제적인 추상화보다는 적절한 중복이 낫다.

---

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

| 계층 | 책임 | 금지 |
|------|------|------|
| presentation | HTTP 요청/응답, DTO 변환 | 비즈니스 로직 |
| application | 유스케이스 오케스트레이션 | 도메인 규칙 구현 |
| domain | 비즈니스 규칙, 엔티티, 값 객체 | 외부 의존성 |
| infrastructure | DB, 외부 API, 설정 | 도메인 로직 |

---

## TypeScript/React (Vite+)

### 코드 스타일

```typescript
// 컴포넌트: PascalCase
export function DomainPackList() { }

// 훅: camelCase, use 접두사
export function useDomainPacks() { }

// 타입/인터페이스: PascalCase
interface DomainPackProps { }

// 상수: UPPER_SNAKE_CASE
const MAX_ITEMS_PER_PAGE = 50;
```

### 컴포넌트 구조

```typescript
// 파일 구성: 컴포넌트 하나당 하나의 책임
// features/domain-pack/ui/DomainPackCard.tsx

import { useState } from 'react';

interface DomainPackCardProps {
  pack: DomainPack;
  onPublish: (id: string) => void;
}

export function DomainPackCard({ pack, onPublish }: DomainPackCardProps) {
  // 상태는 최소화
  const [isLoading, setIsLoading] = useState(false);
  
  // 이벤트 핸들러
  const handlePublish = async () => {
    setIsLoading(true);
    await onPublish(pack.id);
    setIsLoading(false);
  };
  
  return (
    <div className="domain-pack-card">
      <h3>{pack.name}</h3>
      <button onClick={handlePublish} disabled={isLoading}>
        {isLoading ? 'Publishing...' : 'Publish'}
      </button>
    </div>
  );
}
```

### FSD (Feature-Sliced Design) 구조

```
src/
├── app/              # 초기화, 라우팅, 프로바이더
├── pages/            # 페이지 컴포넌트
├── widgets/          # 독립적인 UI 위젯
├── features/         # 사용자 시나리오 단위
├── entities/         # 비즈니스 엔티티
└── shared/           # 공유 컴포넌트, 유틸리티
```

### 가져오기 규칙

```typescript
// 상대 경로는 같은 계층 내에서만
import { Button } from '../ui/Button';

// 다른 계층은 절대 경로 (alias 사용)
import { DomainPack } from '@/entities/domain-pack';
import { usePublishPack } from '@/features/publish-pack';
```

---

## Python (ML Pipeline)

### 코드 스타일

```python
# 함수: snake_case, 동사 + 명사
def ingest_conversations(dataset_path: str) -> Dataset:
    pass

# 클래스: PascalCase, 명사
class IntentClusterer:
    pass

# 상수: UPPER_SNAKE_CASE
DEFAULT_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
```

### 함수 설계

```python
# 단일 책임 함수
def preprocess_conversations(
    conversations: list[Conversation],
    config: PreprocessConfig
) -> list[CleanedConversation]:
    """
    상담 로그에서 boilerplate를 제거하고 canonical text를 생성한다.
    
    Args:
        conversations: 원본 대화 목록
        config: 전처리 설정
    
    Returns:
        정제된 대화 목록
    """
    cleaned = []
    for conv in conversations:
        text = remove_boilerplate(conv.raw_text, config.boilerplate_patterns)
        canonical = generate_canonical(text)
        cleaned.append(CleanedConversation(id=conv.id, text=canonical))
    return cleaned
```

### DAG 스테이지 패턴

```python
from airflow import DAG
from airflow.operators.python import PythonOperator

def create_preprocessing_stage(dag: DAG) -> PythonOperator:
    """
    전처리 스테이지를 생성한다.
    
    Args:
        dag: 부모 DAG
    
    Returns:
        전처리 태스크
    """
    return PythonOperator(
        task_id='preprocessing',
        python_callable=preprocess_conversations,
        dag=dag
    )
```

---

## Git Conventions

### 브랜치 전략

```
main
  └── feature/domain-pack-crud
  └── feature/review-approval-flow
  └── bugfix/pipeline-job-status
```

- `main`: 항상 배포 가능한 상태
- `feature/*`: 새 기능 개발
- `bugfix/*`: 버그 수정
- `hotfix/*`: 긴급 수정

### 커밋 메시지

```
feat(domain-pack): add publish endpoint
fix(pipeline): handle webhook timeout
docs(schema): update table definitions
refactor(review): extract approval logic
test(runtime): add workflow execution tests
```

**Conventional Commits** 형식:
- `type(scope): subject`
- 타입: feat, fix, docs, style, refactor, test, chore
- 스코프: 변경 모듈 (domain-pack, review, pipeline 등)

---

## 코드 리뷰 체크리스트

### PR 작성 전

- [ ] 테스트를 실행했는가?
- [ ] 불필요한 주석을 제거했는가?
- [ ] 중복 코드가 없는가?
- [ ] 명명 규칙을 따랐는가?
- [ ] KISS 원칙을 지켰는가?

### 리뷰 시

- [ ] 코드가 한 가지 일만 하는가?
- [ ] 함수 길이가 50줄 이하인가?
- [ ] 중첩 depth가 3 이하인가?
- [ ] 변수명이 의도를 드러내는가?
- [ ] 에러 처리가 적절한가?

---

## 참고

- [Google Java Style Guide](https://google.github.io/styleguide/javaguide.html)
- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- [PEP 8 - Python Style Guide](https://peps.python.org/pep-0008/)
- [Conventional Commits](https://www.conventionalcommits.org/)
