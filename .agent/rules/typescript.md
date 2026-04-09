# TypeScript/React (Vite+)

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

```text
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

## FSD 의존성 방향 규칙

### 계층 방향 (상위 → 하위만 허용)

```
app → pages → widgets → features → entities → shared
```

- 상위 계층은 하위 계층을 import할 수 있다
- **하위 계층이 상위 계층을 import하는 것은 금지**
- 같은 계층 내 다른 슬라이스 간 import도 금지 (cross-slice)

### 허용되는 import

```typescript
// ✅ pages → features (상위 → 하위)
// frontend/src/pages/consultation/ui/ConsultationPage.tsx
import { ChatPanel } from "@/features/consultation";

// ✅ features → shared (상위 → 하위)
// frontend/src/features/auth/api/authApi.ts
import { apiClient } from "@/shared/api";

// ✅ 같은 슬라이스 내 (internal)
// features/auth/ui/LoginForm.tsx
import { useAuth } from "../model/useAuth";
```

### 금지되는 import

```typescript
// ❌ shared → features (하위 → 상위)
// shared/ui/Header.tsx
import { useAuth } from "@/features/auth";

// ❌ feature 간 cross-import (같은 계층 cross-slice)
// features/consultation/ui/ChatPanel.tsx
import { useAuth } from "@/features/auth";

// ❌ entities → features (하위 → 상위)
// entities/user/model.ts
import { loginApi } from "@/features/auth";

// ❌ feature → pages (하위 → 상위)
// features/auth/ui/LoginForm.tsx
import { Layout } from "@/pages/layout";
```

### Cross-Slice 통신 방법

feature 간 데이터가 필요하면:

1. **공통 entity 사용**: entities 계층에 공유 모델 정의
2. **props로 전달**: pages에서 두 feature를 조합할 때 props로 연결
3. **shared 이벤트**: shared/lib에 이벤트 버스 정의 (복잡한 경우)

### ESLint 검증 (향후 적용)

- `@feature-sliced/layers-slices` 규칙으로 자동 검증 가능
- 현재는 코드 리뷰로 수동 확인 (`.agent/rules/code-review.md` FSD 컴플라이언스 섹션 참조)
  - 참조: `frontend/src/features/consultation/ui/ChatPanel.tsx` — features 내부 구조 예시
  - 참조: `frontend/src/shared/api/index.ts` — shared 계층 API 클라이언트 예시

---

## 참고

- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
