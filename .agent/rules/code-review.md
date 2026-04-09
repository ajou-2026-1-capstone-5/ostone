# 코드 리뷰 체크리스트

## PR 작성 전

- [ ] 테스트를 실행했는가?
- [ ] 불필요한 주석을 제거했는가?
- [ ] 중복 코드가 없는가?
- [ ] 명명 규칙을 따랐는가?
- [ ] KISS 원칙을 지켰는가?

## 리뷰 시

- [ ] 코드가 한 가지 일만 하는가?
- [ ] 함수 길이가 50줄 이하인가?
- [ ] 중첩 depth가 3 이하인가?
- [ ] 변수명이 의도를 드러내는가?
- [ ] 에러 처리가 적절한가?

## 보안 체크

- [ ] 인증/인가가 필요한 엔드포인트에 적용됐는가?
  - 참조: `backend/src/main/java/com/init/shared/infrastructure/security/SecurityConfig.java` — JWT 필터, CORS 설정
  - 주의: `ConsultationService`에는 인가 체크 없음 — 새 서비스는 반드시 추가
- [ ] 사용자 입력이 `@Valid`로 검증되는가?
- [ ] 민감 정보(비밀번호, 토큰)가 응답에 노출되지 않는가?
- [ ] SQL injection 방지: 파라미터 바인딩 사용하는가?
- [ ] CORS 설정이 허용된 origin만 포함하는가?
- [ ] 에러 응답에 스택 트레이스가 노출되지 않는가?

## 성능 체크

- [ ] N+1 쿼리 문제가 없는가? (fetch join 또는 batch size 확인)
- [ ] 대량 데이터에 페이지네이션이 적용됐는가?
- [ ] 불필요한 전체 조회(`findAll`)가 없는가?
- [ ] 프론트엔드: 불필요한 리렌더링이 없는가?
- [ ] 이미지/파일 크기 제한이 있는가?
  - 참조: `frontend/src/pages/consultation/ui/ConsultationPage.tsx` — 5초 폴링 패턴 주의

## DDD 컴플라이언스

- [ ] 도메인 로직이 Entity/Value Object 안에 있는가? (Service에 도메인 로직 금지)
- [ ] Repository 인터페이스가 domain 패키지에 있는가?
- [ ] Application Service가 오케스트레이션만 하는가?
- [ ] Controller에 비즈니스 로직이 없는가?
- [ ] 계층 간 의존성 방향이 올바른가? (`presentation → application → domain ← infrastructure`)
- [ ] Aggregate Root만 Repository를 가지는가?
  - 참조: `backend/src/main/java/com/init/auth/domain/model/AppUser.java` — 도메인 메서드 패턴 모범

## FSD 컴플라이언스 (Frontend)

- [ ] 의존성 방향이 올바른가? (`app → pages → widgets → features → entities → shared`, 상위 → 하위만 허용)
- [ ] feature 간 직접 import가 없는가? (cross-slice 금지)
- [ ] shared에서 feature/entity import가 없는가?
- [ ] 각 feature가 단일 사용자 시나리오에 대응하는가?
- [ ] 공통 컴포넌트가 `shared/ui`에 있는가?
  - 참조: `frontend/src/features/consultation/ui/ChatPanel.tsx` — features 내부 구조

## 테스트 체크

- [ ] 새 기능에 대한 테스트가 추가됐는가?
- [ ] 테스트가 Given-When-Then 패턴을 따르는가?
  - 참조: `.agent/rules/testing.md` — BDD 패턴 상세
- [ ] Happy path + 실패 시나리오 모두 커버하는가?
- [ ] 테스트가 독립적으로 실행 가능한가? (다른 테스트에 의존 금지)
