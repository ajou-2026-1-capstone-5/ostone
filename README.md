# 상담 로그 기반 CS 워크플로우 생성 시스템

아주대학교 26학년도 1학기 'SW캡스톤프로젝트' 5조 레포지토리

## 프로젝트 개요

상담 로그 데이터를 분석하여 자동으로 CS 워크플로우를 생성하는 시스템

## 팀원

- **강희원** (201920717) - kangheewon@ajou.ac.kr - [@kang-heewon](https://github.com/kang-heewon)
- **강준현** (202126906) - jhkang0516@ajou.ac.kr - [@jhkang0516](https://github.com/jhkang0516)
- **배성연** (202020776, **팀장**) - bsy309@ajou.ac.kr - [@syeobnn](https://github.com/syeobnn)
- **하장한** (202126852) - egnever4434@gmail.com - [@devjhan](https://github.com/devjhan)

## 기술 스택

| 영역        | 기술                 | 버전   |
| ----------- | -------------------- | ------ |
| Backend     | Java 21, Spring Boot | 3.4.5  |
| Frontend    | Vite+                | 0.1.15 |
| ML Pipeline | Python 3.13+, uv     | -      |

## 작업 규칙

### SDD 워크플로우

1. Burndown Studio에서 이슈 생성
2. `spec/{이슈번호}` 브랜치에서 스펙 작성 → PR
3. `feature/{이슈번호}-{설명}` 브랜치에서 구현 → PR

### 브랜치 규칙

| 패턴                    | 용도        |
| ----------------------- | ----------- |
| `spec/{번호}`           | 스펙 작성   |
| `feature/{번호}-{설명}` | 기능 구현   |
| `fix/{번호}-{설명}`     | 버그 수정   |
| `chore/{설명}`          | 인프라/잡일 |
| `docs/{설명}`           | 문서        |

### 커밋

Conventional Commits: `type(scope): subject` (예: `feat(domain-pack): add publish`)

상세 규칙: [`.agent/rules/git.md`](.agent/rules/git.md)

## 로컬 개발환경 세팅

```bash
# Docker Compose로 전체 서비스 실행
docker-compose up -d

# Backend: Gradle build
cd backend && ./gradlew build

# Frontend: pnpm dev
cd frontend && pnpm dev

# ML: pytest
cd ml && pytest
```

상세 설정: [`backend/README.md`](backend/README.md)

## 모듈 구조

```
├── backend/   # Spring Boot API 서버
├── frontend/  # Vite+ 웹 애플리케이션
└── ml/        # Python ML 워크플로우 생성 모델
```

## 로컬 개발환경 세팅

```bash
# Docker Compose로 전체 서비스 실행
docker-compose up -d
```
