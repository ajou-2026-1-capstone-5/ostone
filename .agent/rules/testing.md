# 테스트 전략

## 철학

- **BDD (Behavior-Driven Development) 기반**: 사용자 행동 중심 테스트
- **Given-When-Then 패턴**: 시나리오를 명확하게 기술
- **"무엇을 테스트하는가"가 명확해야 함**: 구현이 아닌 동작 검증

## 테스트 피라미드

- **Unit (60%)**: 도메인 로직, 유틸리티 — 빠르고 격리된 테스트
- **Integration (30%)**: Service + Repository, Controller + MockMvc
- **E2E (10%)**: 핵심 사용자 시나리오 — 느리지만 신뢰성 높음

## 커버리지 목표와 CI 기준

- **장기 라인 커버리지 목표**: 70% 이상 (캡스톤 현실 고려)
- **도메인 로직**: 90% 이상 (비즈니스 규칙은 반드시)
- **새 코드**: 80% 이상 (레거시 제외)
- **초기 CI baseline**: 레거시 공백 때문에 모듈별 현재 기준을 먼저 강제하고, 이후 coverage 개선 PR에서 상향한다.

### 커버리지 측정 절차

| 스택              | 로컬 실행 명령                    | CI 강제 기준                                           | 생성되는 리포트                                                                                               |
| ----------------- | --------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Backend (JaCoCo)  | `pnpm run test:backend:coverage`  | line 90%, branch 70%                                   | `backend/build/reports/jacoco/test/jacocoTestReport.xml`, `backend/build/reports/jacoco/test/html/index.html` |
| Frontend (Vitest) | `pnpm run test:frontend:coverage` | statements 80%, branches 70%, functions 75%, lines 80% | `frontend/coverage/index.html`, `frontend/coverage/lcov.info`                                                 |
| ML (pytest-cov)   | `pnpm run test:ml:coverage`       | total 80% (`tool.coverage.report.fail_under`)          | `ml/coverage.xml`, terminal missing-line report                                                               |

**PR 체크포인트**: CI basic은 루트 package scripts인 `pnpm run ci:backend`, `pnpm run ci:frontend`, `pnpm run e2e:frontend`, `pnpm run ci:ml`을 실행한다. Backend `jacocoTestCoverageVerification`, Frontend Vitest coverage threshold, ML `fail_under = 80`이 실제로 실행되며, coverage artifact의 HTML/XML/LCOV 리포트에서 부족한 파일과 라인을 확인한다.

## 품질 검사 책임 분리

| 구분             | 목적                                  | 실행 명령                                                                                                                                                                                              |
| ---------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| pre-commit       | staged 파일 대상 빠른 검사            | `pnpm exec lint-staged`가 `format:backend:check`, `lint:frontend`, `format:frontend`, `lint:ml`, `format:ml`, `typecheck:ml` 호출                                                                      |
| CI basic         | PR에서 반드시 막아야 하는 최소 품질선 | `pnpm run ci:backend`, `pnpm run ci:frontend`, `pnpm run e2e:frontend`, `pnpm run ci:ml`                                                                                                               |
| CI full / manual | 느리거나 포괄적인 검사                | `pnpm run test:backend:coverage`, `pnpm run ci:backend:sonar`, `pnpm run test:frontend:coverage`, `pnpm run test:ml:coverage`, `pnpm run lint:backend`, `pnpm run quality:ml`, `pnpm run format:check` |

CI basic에서 backend checkstyle, frontend lint, ML ruff/mypy를 모두 반복 실행하지 않는 이유는 PR feedback 시간을 줄이기 위해서다. 해당 검사는 pre-commit과 full/manual package scripts에서 실행 위치를 명확히 나눈다.

| 모듈     | pre-commit 포함 검사          | CI basic 포함 검사                            | CI full / manual 포함 검사                         |
| -------- | ----------------------------- | --------------------------------------------- | -------------------------------------------------- |
| Backend  | Spotless format check         | PostgreSQL/Liquibase test, build              | checkstyle, JaCoCo/Sonar 사전 테스트               |
| Frontend | ESLint, Vite+ format          | Vitest coverage, production build, mocked E2E | coverage test, SonarCloud 분석                     |
| ML       | ruff check, ruff format, mypy | uv sync, coverage pytest                      | ruff format check, ruff check, mypy, coverage test |

## Backend (JUnit 5 + Spring Boot Test)

### 테스트 파일 위치

- `src/test/java`에 프로덕션 코드와 동일 패키지 구조
- 파일명: `{대상클래스}Test.java`

### 네이밍 규칙

- 메서드명: `should_결과_when_조건` (한글 혼용 가능)
- `@DisplayName`: 한글로 시나리오 설명

### BDD 패턴 (Given-When-Then)

```java
@Test
@DisplayName("GET /api/v1/consultation/queue - 대기열 조회 성공")
void should_대기열반환_when_인증된사용자요청() throws Exception {
    // given
    ChatSessionResponse response = new ChatSessionResponse();
    response.setId(1L);
    response.setStatus("OPEN");
    given(consultationService.getActiveQueue()).willReturn(List.of(response));

    // when & then
    mockMvc.perform(get("/api/v1/consultation/queue"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value(1));
}
```

### 계층별 테스트 전략

| 계층                        | 테스트 방식                     | 의존성                    |
| --------------------------- | ------------------------------- | ------------------------- |
| Domain (Entity/VO)          | 순수 단위 테스트                | 없음                      |
| Application (Service)       | `@ExtendWith(MockitoExtension)` | Mock Repository           |
| Presentation (Controller)   | `@WebMvcTest` + MockMvc         | Mock Service              |
| Infrastructure (Repository) | `@DataJpaTest`                  | 실 DB (H2/TestContainers) |

### 필수 테스트 시나리오

1. Happy path (정상 흐름)
2. Validation 실패 (잘못된 입력)
3. Not found (존재하지 않는 리소스)
4. 권한 없음 (인가 실패)
5. 중복 (unique constraint 위반)

### 참조 구현

- `backend/src/test/java/com/init/workflowruntime/presentation/ConsultationControllerTest.java`: MockMvc + @WebMvcTest 패턴

## Frontend (Vitest + React Testing Library)

### 테스트 파일 위치

- 대상 파일과 동일 디렉토리에 `{파일명}.test.ts(x)`

### API 테스트 패턴

```typescript
import { describe, it, expect, vi, beforeEach } from "vite-plus/test";

describe("Auth API Integration Tests", () => {
  const mockFetch = vi.fn();
  vi.stubGlobal("fetch", mockFetch);

  beforeEach(() => {
    mockFetch.mockClear();
  });

  it("loginApi 메서드가 올바른 URL과 데이터를 사용하여 fetch를 호출하는지 확인한다", async () => {
    // given
    const mockResponse = {
      accessToken: "dummy-access",
      user: { id: 1, email: "test@test.com" },
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    // when
    const result = await loginApi({
      email: "test@test.com",
      password: "password123",
    });

    // then
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/auth/login",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(result.accessToken).toEqual("dummy-access");
  });
});
```

### 컴포넌트 테스트 패턴

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("LoginForm", () => {
  it("유효한 이메일과 비밀번호로 제출하면 로그인 API를 호출한다", async () => {
    // given
    const mockLogin = vi.fn();
    render(<LoginForm onLogin={mockLogin} />);

    // when
    await userEvent.type(screen.getByLabelText("이메일"), "user@test.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    // then
    expect(mockLogin).toHaveBeenCalledWith({
      email: "user@test.com",
      password: "password123",
    });
  });
});
```

### 참조 구현

- `frontend/src/features/auth/api/authApi.test.ts`: Vitest API 테스트 패턴

## 금지 사항

- **구현 세부사항 테스트 금지**: 내부 상태, private 메서드 테스트하지 않음
- **sleep/setTimeout으로 비동기 대기 금지**: `waitFor`/`awaitility` 사용
- **테스트 간 상태 공유 금지**: 각 테스트는 독립적이어야 함
- **테스트에서 프로덕션 DB 접근 금지**: H2 또는 TestContainers 사용

## 검증 방법

- **PR 리뷰**: `.agent/rules/code-review.md` 테스트 체크리스트 참조
- **CI basic**: `pnpm run ci:backend`, `pnpm run ci:frontend`, `pnpm run e2e:frontend`, `pnpm run ci:ml`
- **Full/manual**: `pnpm run lint:backend`, `pnpm run quality:ml`, `pnpm run format:check`
