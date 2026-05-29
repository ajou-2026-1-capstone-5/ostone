# Frontend (Vite+ FSD)

상담 로그 기반 CS 워크플로우 시스템의 프론트엔드 모듈. 자세한 프로젝트 컨텍스트는 루트 [`AGENTS.md`](../AGENTS.md) 참조.

## Quick Commands

| 목적          | 명령어         |
| ------------- | -------------- |
| 개발 서버     | `pnpm dev`     |
| 빌드          | `pnpm build`   |
| 테스트        | `pnpm test`    |
| 린트          | `pnpm lint`    |
| 포맷          | `pnpm format`  |
| API 코드 생성 | `pnpm api:gen` |

## API Codegen Workflow

Backend OpenAPI 스펙을 입력으로 TypeScript 타입, TanStack Query hooks, Zod 런타임 스키마를 자동 생성한다. 도구: [Orval](https://orval.dev) v8.

### 워크플로우

1. **백엔드 OpenAPI 스펙 생성**:

   ```bash
   cd backend && ./gradlew clean generateOpenApiDocs
   # → backend/build/openapi.json 생성
   ```

2. **프론트엔드 코드 생성**:

   ```bash
   cd frontend && pnpm api:gen
   # → frontend/src/shared/api/generated/ 갱신
   ```

3. **변경 확인 + 커밋**: `git diff frontend/src/shared/api/generated/`

> **주의**: `pnpm api:gen` 실행 전에 반드시 1단계(`./gradlew generateOpenApiDocs`)를 선행해야 한다. backend openapi.json이 부재하면 codegen 자체는 동작하지 않으며, hash metadata(`.codegen-meta.json`)도 갱신되지 않는다.

### .codegen-meta.json (codegen 정합성 metadata)

Orval `afterAllFilesWrite` hook이 `pnpm api:gen` 실행 시 자동 갱신하는 metadata 파일.

- 위치: `frontend/src/shared/api/generated/.codegen-meta.json` (commit 대상)
- 포함 필드: `schemaVersion`, `openapiHash`(sha256), `openapiPathsCount`, `generatedAt`, `orvalVersion`, `openapiSourcePath`
- 용도: 5stone 파이프라인의 specGatekeeper C7 검사가 본 파일의 `openapiHash`와 `backend/build/openapi.json`의 sha256을 비교하여 BE↔FE codegen drift를 탐지한다.
- 직접 수정 금지: 사람이 손대지 않는다. 매 codegen 실행마다 덮어써진다.

### 운영 전제 (generateOpenApiDocs)

`./gradlew generateOpenApiDocs`는 정적 파일 생성이 아니라 **forked Spring Boot 앱을 실제 기동**하여 `/v3/api-docs`를 호출한다. 다음이 충족되지 않으면 실패한다:

- PostgreSQL 활성: 이미 실행 중인 postgres에 의존 (포트 5432)
- 포트 8089 사용 가능 (openApi 블록에서 고정)
- Spring 프로필 `local` (build.gradle.kts `customBootRun.args`에 명시됨)
- `JWT_SECRET` 등 필수 환경 변수 설정됨

이 전제가 깨지면 forkedSpringBootRun 단계에서 stack trace가 출력된다. 단순 codegen 실패가 아니라 backend 앱 기동 실패이므로, 백엔드 단독 실행 가능 여부를 먼저 확인한다.

### 생성된 코드 사용 정책 (중요)

`frontend/src/shared/api/generated/`는 **transport / types / schema 계층으로만** 사용한다. 생성된 React Query hook을 features에서 직접 import해 소비하는 것을 표준으로 강제하지 않는다.

**권장 패턴**:

- 생성된 타입과 zod 스키마: `features/*/api/`, `entities/*/api/`에서 자유롭게 import
- 생성된 hook: `features/*/api/`에서 래핑한 뒤 wrapper를 컴포넌트에서 소비
- 직접 import는 단순 read-only 케이스에만
- HTTP 호출 기본값은 generated endpoint function/hook이며, `apiClient`/`customFetch` 직접 호출은 generated에 없는 endpoint에만 허용
- wrapper는 unwrap/select, query key 표준화, toast/error mapping, optimistic update, response normalization 목적일 때만 유지
- 수동 endpoint 호출을 남길 때는 해당 파일에 OpenAPI 미생성 endpoint임을 주석으로 남김
- generated 파일은 직접 수정하지 않고 backend OpenAPI 갱신 후 `pnpm api:gen`으로 재생성

**예시**:

```typescript
// features/workspace-list/api/useWorkspaceList.ts
import { useGetWorkspaces } from "@/shared/api/generated/endpoints/workspace-controller";

export const useWorkspaceList = () => {
  return useGetWorkspaces({ query: { staleTime: 60_000 } });
};
```

### Mutator (apiClient 재사용)

`shared/api/mutator.ts`가 기존 `apiClient`를 wrapping — 모든 generated hook이 자동으로 인증 헤더 사용.

### lint-staged 제외

`lint-staged.config.js`가 `frontend/src/shared/api/generated/`를 lint 대상에서 제외 — codegen 재실행 시 포맷 충돌 회피.

### 알려진 함정

- `generateOpenApiDocs`는 forkedSpringBootRun으로 실제 앱 시작 → DB 미실행 시 실패
- OpenAPI 3.0 강제 (3.1은 Orval + Zod 호환 이슈)
- `pnpm api:gen`은 `frontend/` 디렉토리에서 실행 (CWD 상대 경로)
- Zod 4.3.6 호환성: smoke test로 회귀 가드 (generated.test.ts)

## FSD 구조

상위 → 하위만 import 가능: `app → pages → widgets → features → entities → shared`. 자세한 컨벤션은 루트 [`AGENTS.md`](../AGENTS.md)와 [`.agent/rules/typescript.md`](../.agent/rules/typescript.md) 참조.
