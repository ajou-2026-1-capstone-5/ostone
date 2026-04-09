# 테스트 전략

## 철학

- **BDD (Behavior-Driven Development) 기반**: 사용자 행동 중심 테스트
- **Given-When-Then 패턴**: 시나리오를 명확하게 기술
- **"무엇을 테스트하는가"가 명확해야 함**: 구현이 아닌 동작 검증

## 테스트 피라미드

- **Unit (60%)**: 도메인 로직, 유틸리티 — 빠르고 격리된 테스트
- **Integration (30%)**: Service + Repository, Controller + MockMvc
- **E2E (10%)**: 핵심 사용자 시나리오 — 느리지만 신뢰성 높음

## 커버리지 목표

- **라인 커버리지**: 70% 이상 (캡스톤 현실 고려)
- **도메인 로직**: 90% 이상 (비즈니스 규칙은 반드시)
- **새 코드**: 80% 이상 (레거시 제외)

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
void getActiveQueue_Success() throws Exception {
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
- **CI**: `./gradlew test` (Backend), `vp test` (Frontend)
