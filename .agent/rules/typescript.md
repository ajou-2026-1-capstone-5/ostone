## TypeScript/React (Vite+)

### 코드 스타일

```typescript
// 컴포넌트: PascalCase
export function DomainPackList() {}

// 훅: camelCase, use 접두사
export function useDomainPacks() {}

// 타입/인터페이스: PascalCase
interface DomainPackProps {}

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
import { Button } from "../ui/Button";

// 다른 계층은 절대 경로 (alias 사용)
import { DomainPack } from "@/entities/domain-pack";
import { usePublishPack } from "@/features/publish-pack";
```

---

## 참고

- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
