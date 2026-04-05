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

- **Backend**: Spring Boot 4.0.5
- **Frontend**: Vite+ 0.1.15
- **ML**: uv Python 3.14.3

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
