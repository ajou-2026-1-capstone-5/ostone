# Git 워크플로우

## 브랜치 전략

| 용도        | 패턴                        | 예시                             |
| ----------- | --------------------------- | -------------------------------- |
| 스펙 작성   | `spec/{이슈번호}`           | `spec/12`                        |
| 기능 구현   | `feature/{이슈번호}-{설명}` | `feature/12-auth-implementation` |
| 버그 수정   | `fix/{이슈번호}-{설명}`     | `fix/15-login-error`             |
| 인프라/잡일 | `chore/{설명}`              | `chore/update-ci`                |
| 문서        | `docs/{설명}`               | `docs/update-readme`             |
| 보호        | `main`                      | 직접 push 금지, PR만 허용        |

## SDD 워크플로우

Spec-Driven Development (SDD) 프로세스:

```
1. Burndown Studio에서 이슈 생성 (#12)
2. spec/12 브랜치 → .agent/specs/12.md 작성 → PR
3. feature/12-auth 브랜치 → 구현 → PR
```

### 스펙 파일 위치

- `.agent/specs/{이슈번호}.md`
- 예: `.agent/specs/12.md`

## 커밋 메시지

Conventional Commits 형식:

```
feat(domain-pack): add publish endpoint
fix(pipeline): handle webhook timeout
docs(schema): update table definitions
refactor(review): extract approval logic
test(runtime): add workflow execution tests
```

**형식**: `type(scope): subject`

**타입**:

- `feat`: 새 기능
- `fix`: 버그 수정
- `docs`: 문서
- `style`: 포맷팅
- `refactor`: 리팩토링
- `test`: 테스트
- `chore`: 잡일

**스코프**: 변경 모듈 (domain-pack, review, pipeline 등)

## CI 연동

GitHub Actions CI가 브랜치 패턴을 검증한다:

- `feature/*`, `fix/*`, `spec/*` → 해당 이슈 번호의 스펙 파일 필수
- `chore/*`, `docs/*` → 스펙 불필요, 패턴만 검증
- `main` → 직접 push 금지

---

## 참고

- [Conventional Commits](https://www.conventionalcommits.org/)
