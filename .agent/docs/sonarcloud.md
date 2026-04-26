# SonarCloud 통합 가이드

## 1. 개요

ostone 프로젝트는 코드 품질과 보안 취약점을 지속적으로 추적하기 위해 SonarCloud를 CI 파이프라인에 통합한다.

이 프로젝트는 세 개의 독립적인 모듈로 구성되어 있어, SonarCloud 분석도 모듈별로 분리해서 운영한다.

| 모듈 | 언어 | SonarCloud 프로젝트 키 |
| --- | --- | --- |
| backend | Java 21 / Spring Boot | `ajou-2026-1-capstone-5_ostone_backend` |
| frontend | TypeScript / React | `ajou-2026-1-capstone-5_ostone_frontend` |
| ml | Python 3.13+ | `ajou-2026-1-capstone-5_ostone_ml` |

각 모듈은 GitHub Actions에서 별도 job으로 실행되며, PR마다 3개 분석이 모두 통과해야 merge가 가능하다.

---

## 2. 사전 준비 상태 확인 (이미 완료된 항목 체크)

아래 항목 중 체크된 것은 이미 완료된 상태다. 미체크 항목만 순서대로 진행한다.

- [x] SonarCloud organization `ajou-2026-1-capstone-5` 존재 확인 (생성 완료)
- [x] 3개 프로젝트 존재 확인 (이미 생성됨):
  - `ajou-2026-1-capstone-5_ostone_backend`
  - `ajou-2026-1-capstone-5_ostone_frontend`
  - `ajou-2026-1-capstone-5_ostone_ml`
- [ ] SonarCloud GitHub App 설치 확인
  1. SonarCloud → organization `ajou-2026-1-capstone-5` → Administration → Organization Settings → Integrations
  2. GitHub 연결 상태 확인
  3. 미설치 상태라면 "Install GitHub App" 버튼으로 설치 진행
  4. 설치 시 ostone 저장소 접근 권한 포함 여부 확인
- [ ] SONAR_TOKEN 발급
  1. SonarCloud → 우측 상단 프로필 → My Account → Security
  2. "Generate Tokens" 섹션에서 토큰 이름 입력 (예: `ostone-ci`)
  3. Type: "Project Analysis Token" 또는 "Global Analysis Token" 선택
  4. Generate 클릭 후 토큰 값 즉시 복사 (이후 재확인 불가)
- [ ] GitHub Repository Secret `SONAR_TOKEN` 등록
  1. GitHub 저장소 → Settings → Secrets and variables → Actions
  2. "New repository secret" 클릭
  3. Name: `SONAR_TOKEN`
  4. Secret: 위에서 복사한 토큰 값 붙여넣기
  5. "Add secret" 클릭

---

## 3. organization/project key 변경 시 (선택 사항)

현재 코드베이스에는 `ajou-2026-1-capstone-5` organization key와 각 모듈의 project key가 이미 설정되어 있다. organization 또는 project key를 변경해야 하는 경우에만 아래 명령을 실행한다.

```bash
export OLD_ORG="ajou-2026-1-capstone-5"
export NEW_ORG="new-org-key"
grep -l "$OLD_ORG" backend/build.gradle.kts frontend/sonar-project.properties ml/sonar-project.properties README.md \
  | xargs sed -i.bak "s/$OLD_ORG/$NEW_ORG/g"
find backend frontend ml README.md -name '*.bak' -delete
git diff
```

변경 후 `git diff`로 치환 결과를 반드시 확인한다. 의도치 않은 파일이 변경됐다면 `git checkout -- <파일>` 로 되돌린다.

---

## 4. branch protection 설정 (Quality Gate 게이트)

SonarCloud Quality Gate를 PR merge 조건으로 강제하려면 GitHub branch protection rule을 설정해야 한다.

### 4.1 설정 경로

1. GitHub 저장소 → Settings → Branches
2. "Branch protection rules" 섹션 → "Add rule" 클릭
3. Branch name pattern: `main`

### 4.2 필수 활성화 항목

| 항목 | 설정값 |
| --- | --- |
| Require a pull request before merging | ON |
| Require status checks to pass before merging | ON |
| Require branches to be up to date before merging | ON (권장) |

### 4.3 SonarCloud Status Check 등록

"Require status checks to pass" 활성화 후 검색창에서 아래 3개를 찾아 추가한다.

- `SonarCloud Code Analysis — backend-sonar` (workflow job: `backend-sonar`)
- `SonarCloud Code Analysis — frontend-sonar` (workflow job: `frontend-sonar`)
- `SonarCloud Code Analysis — ml-sonar` (workflow job: `ml-sonar`)

### 4.4 설정 저장

"Create" 또는 "Save changes" 클릭으로 rule 저장.

---

## 5. New Code 정의 설정 (SonarCloud UI)

SonarCloud는 "New Code" 기준으로 Quality Gate를 평가한다. 기본값이 프로젝트마다 다를 수 있으므로 3개 프로젝트 모두 동일하게 맞춘다.

### 5.1 설정 경로 (프로젝트별 반복)

1. SonarCloud → organization `ajou-2026-1-capstone-5` → 프로젝트 선택
2. Administration → New Code
3. "Number of days" 선택 → 값: `30`
4. Save 클릭

### 5.2 대상 프로젝트

- `ajou-2026-1-capstone-5_ostone_backend`
- `ajou-2026-1-capstone-5_ostone_frontend`
- `ajou-2026-1-capstone-5_ostone_ml`

---

## 6. 검증 체크리스트

설정 완료 후 아래 항목을 순서대로 확인한다.

- [ ] PR 생성 → GitHub Actions에서 3개 sonar job 모두 실행 확인
- [ ] 3개 sonar job 모두 통과 (green check)
- [ ] PR 타임라인에 SonarCloud bot 댓글 출현 (분석 결과 요약 포함)
- [ ] SonarCloud UI에서 3개 프로젝트 모두 분석 결과 표시 확인
- [ ] Quality Gate 의도적 fail 테스트: 코드에 명백한 버그 또는 취약점 추가 후 PR 생성 → merge 차단 확인
- [ ] branch protection rule이 SonarCloud check를 필수로 요구하는지 확인

---

## 7. 트러블슈팅

### 첫 분석 시 baseline이 비어 있음

**증상**: 첫 PR 분석에서 "No previous analysis" 또는 coverage 비교 불가 메시지 출력.

**원인**: SonarCloud는 main 브랜치 분석 결과를 baseline으로 사용한다. main에 한 번도 분석이 실행되지 않으면 비교 기준이 없다.

**해결**: main 브랜치에 push를 한 번 수행해 baseline 분석을 생성한다. 이후 PR 분석부터 정상적으로 비교가 동작한다.

---

### Sonar Way Quality Gate의 coverage 80% 조건

**증상**: 첫 분석에서 coverage 조건 미달로 Quality Gate fail.

**원인**: Sonar Way 기본 Quality Gate는 New Code coverage 80% 이상을 요구한다. baseline이 없는 상태에서는 모든 코드가 New Code로 간주된다.

**해결**: main 브랜치 baseline 분석 후 자동으로 정상화된다. baseline 이후 PR에서는 변경된 코드만 New Code로 평가한다. 초기 단계에서 coverage 조건이 너무 엄격하다면 SonarCloud → Administration → Quality Gates에서 조건을 조정할 수 있다.

---

### SONAR_TOKEN 만료 또는 무효화

**증상**: CI에서 `401 Unauthorized` 또는 `Invalid token` 오류 발생.

**해결**:

1. SonarCloud → My Account → Security → 기존 토큰 Revoke
2. 새 토큰 Generate (이름 예: `ostone-ci-renewed`)
3. GitHub 저장소 → Settings → Secrets and variables → Actions → `SONAR_TOKEN` → Update
4. 새 토큰 값으로 교체 후 저장
5. CI 재실행으로 정상 동작 확인

---

### Fork PR에서 분석이 실행되지 않음

**증상**: 외부 기여자의 fork에서 올린 PR에서 sonar job이 스킵되거나 실패.

**원인**: GitHub Actions는 보안상 fork PR에서 repository secret에 접근할 수 없다. `SONAR_TOKEN`이 없으면 분석을 실행할 수 없다.

**해결**: 이것은 의도된 동작이다. 외부 fork PR은 SonarCloud 분석 없이 진행되며, 팀 내부 브랜치 PR에서만 분석이 실행된다. 이 동작을 변경하려면 `pull_request_target` 이벤트와 별도 보안 검토가 필요하다.

---

### SonarCloud bot 댓글이 PR에 나타나지 않음

**증상**: 분석은 성공했지만 PR에 SonarCloud 댓글이 없음.

**해결**:

1. SonarCloud → organization → Administration → GitHub Integration 확인
2. "Decorate pull requests" 옵션이 활성화되어 있는지 확인
3. GitHub App 권한에 "Pull requests: Read and write" 포함 여부 확인
