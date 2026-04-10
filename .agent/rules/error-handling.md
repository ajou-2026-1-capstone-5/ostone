# 에러 핸들링 패턴

## 원칙

- 에러는 사용자에게 의미 있는 메시지로 전달한다
- 시스템 내부 정보(스택 트레이스, DB 쿼리)는 노출하지 않는다
- 에러 응답 형식을 통일한다

## Backend 에러 처리

### 예외 계층 구조

```text
BusinessException (추상) — 비즈니스 규칙 위반
├── NotFoundException — 404: 리소스 없음
├── DuplicateException — 409: 중복
├── InvalidCredentialsException — 401: 인증 실패
├── InvalidTokenException — 401: 토큰 무효
├── UnauthorizedException — 403: 권한 없음
└── BadRequestException — 400: 잘못된 요청
```

### HTTP 상태 코드 매핑

아래 표는 base exception class 기준이다. 구체 예외는 해당 base class를 상속하여 세분화한다.

| Exception                         | HTTP Status | 사용 시점              |
| --------------------------------- | ----------- | ---------------------- |
| `NotFoundException`               | 404         | findById 실패          |
| `DuplicateException`              | 409         | unique constraint 위반 |
| `InvalidCredentialsException`     | 401         | 로그인 실패            |
| `InvalidTokenException`           | 401         | 토큰 검증 실패         |
| `UnauthorizedException`           | 403         | 권한 부족              |
| `BadRequestException`             | 400         | 비즈니스 검증 실패     |
| `MethodArgumentNotValidException` | 400         | @Valid 실패            |
| `Exception` (fallback)            | 500         | 예상치 못한 오류       |

예: `DuplicateException` → `EmailAlreadyExistsException`, `UnauthorizedException` → `UnauthorizedWorkspaceAccessException`와 같이 구체 예외를 정의한다.

### 에러 응답 DTO

```java
// 모든 에러 응답의 통일된 형식
public record ErrorResponse(
    String code,      // "NOT_FOUND", "DUPLICATE" 등
    String message    // 사용자 친화적 메시지 (한글)
) {}
```

### GlobalExceptionHandler 패턴

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(NotFoundException.class)
  public ResponseEntity<ErrorResponse> handleNotFound(NotFoundException ex) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(new ErrorResponse("NOT_FOUND", ex.getMessage()));
  }

  @ExceptionHandler(EmailAlreadyExistsException.class)
  public ResponseEntity<ErrorResponse> handleEmailAlreadyExists(EmailAlreadyExistsException ex) {
    return ResponseEntity.status(HttpStatus.CONFLICT)
        .body(new ErrorResponse("EMAIL_ALREADY_EXISTS", ex.getMessage()));
  }

  // ✅ GlobalExceptionHandler 전용: fallback 경계에서만 허용
  @ExceptionHandler(Exception.class)
  public ResponseEntity<ErrorResponse> handleGeneric(Exception ex) {
    log.error("Unhandled exception", ex);
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(new ErrorResponse("INTERNAL_SERVER_ERROR", "서버 오류가 발생했습니다."));
  }
}
```

**참조**: `backend/src/main/java/com/init/shared/presentation/GlobalExceptionHandler.java` (105L)

### 서비스 레이어 에러 처리 패턴

```java
// 도메인 예외 사용 (적절)
public User findById(Long id) {
    return repository.findById(id)
        .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다: " + id));
}

// DataIntegrityViolation catch (중복 처리)
public void signup(SignupCommand command) {
    try {
        repository.save(new AppUser(command));
    } catch (DataIntegrityViolationException e) {
        throw new EmailAlreadyExistsException("이미 가입된 이메일입니다");
    }
}
```

**참조**: `backend/src/main/java/com/init/auth/application/AuthService.java:88`

## Frontend 에러 처리

### 금지: alert() 사용

alert()는 UX를 해치므로 프로덕션 코드에서 금지한다. 대신 Toast/Notification 컴포넌트를 사용한다.

**안티패턴** (`frontend/src/pages/consultation/ui/ConsultationPage.tsx:133,142,147`):

```tsx
// ❌ 금지
catch (error) {
  alert('오류가 발생했습니다');  // UX 저하
}
```

### API 에러 처리 패턴

```tsx
// API 호출 시 try-catch
try {
  const data = await api.getData();
  // 성공 처리
} catch (error) {
  if (error instanceof ApiError) {
    toast.error(error.message); // 서버 에러 메시지 표시
  } else {
    toast.error("알 수 없는 오류가 발생했습니다");
    console.error(error); // 개발자 디버깅용
  }
}
```

### 컴포넌트 에러 경계

- React ErrorBoundary로 렌더링 에러 포착
- 사용자에게 "문제 발생" 화면 표시 + 새로고침 버튼

### 로딩/에러/빈 상태 3종 세트

- 모든 데이터 fetching 컴포넌트는 loading/error/empty 상태 처리 필수
- skeleton UI 또는 spinner로 로딩 표시
- 에러 시 재시도 버튼 제공

## 로깅 기준

| 레벨  | 사용 시점              | 예시                        |
| ----- | ---------------------- | --------------------------- |
| ERROR | 시스템 장애, 복구 불가 | DB 연결 실패, 외부 API 다운 |
| WARN  | 비정상이나 복구 가능   | 재시도 성공, 폴백 사용      |
| INFO  | 중요 비즈니스 이벤트   | 로그인, 결제, 배포          |
| DEBUG | 디버깅 정보            | 쿼리 파라미터, 중간 계산값  |

## 금지 사항

- **catch 블록 비우기 금지**: 최소 로깅 필요
- **예외 삼키기 금지**: catch 후 무시하지 않음
- **서비스/도메인 레이어에서 일반 Exception catch 금지**: 구체적 예외 사용. `GlobalExceptionHandler`의 fallback `@ExceptionHandler(Exception.class)` 전용 경계에서만 허용.
- **에러 메시지에 기술 용어 금지**: 사용자 친화적 한글
- **console.log를 프로덕션 에러 처리로 사용 금지**: 적절한 로깅 프레임워크 사용
