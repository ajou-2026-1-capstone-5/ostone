# ML 파이프라인 개발 가이드

상담 로그 기반 CS 워크플로우 생성 시스템의 ML 파이프라인 개발용 문서입니다.

이 문서는 팀원이 로컬에서 파이프라인을 실행하고, Airflow DAG를 확인하고, 새 Stage/DAG를 추가할 때 헷갈리지 않도록 현재 저장소 기준의 개발 방법을 정리합니다.

## 목적

- 상담 로그에서 운영 지식을 추출하는 파이프라인 코드를 개발한다.
- Airflow 로컬 런타임에서 DAG 파싱, 수동 실행, 로그 확인, artifact 생성 흐름을 검증한다.
- Stage 로직과 DAG orchestration 코드를 분리해서 관리한다.

## 사전 준비

- Python `3.13+`
- `uv`
- 루트 `.env` 파일 준비
- Docker / Docker Compose v2

## 빠른 시작

루트 경로에서 먼저 로컬 공통 스택을 올립니다.

```bash
cp .env.example .env
docker compose up -d
```

파이썬 개발 의존성을 맞춥니다.

```bash
cd ml
uv sync
```

테스트와 정적 검사를 실행합니다.

```bash
uv run pytest
uv run ruff check .
uv run ruff format .
uv run mypy .
```

## Airflow 로컬 실행

Airflow는 루트 `docker-compose.yml` 기준으로 함께 실행됩니다.

- UI 주소: `http://localhost:8081`
- 관리자 계정: 기본 `admin / admin`
- 조회 전용 계정: 기본 `viewer / viewer`

Airflow metadata는 로컬 Postgres의 기존 `init` DB와 `init` 계정을 그대로 사용합니다. 별도 Airflow 전용 DB/user를 생성하지 않습니다.

기본 로컬 개발값은 compose fallback으로 `admin / admin`, `viewer / viewer`입니다. 필요하면 루트 `.env`에서 덮어쓸 수 있습니다.

Airflow 관련 컨테이너:

- `airflow-init`: one-shot 초기화 컨테이너
- `airflow-apiserver`: UI/API 서버
- `airflow-scheduler`: 스케줄러
- `airflow-dag-processor`: DAG 파서

`airflow-init`가 `Exited` 상태로 보이는 것은 정상입니다.  
초기화가 끝나면 종료되고, 실제 런타임은 나머지 3개 서비스가 담당합니다.

상태 확인:

```bash
docker compose ps airflow-apiserver airflow-scheduler airflow-dag-processor airflow-init
```

로그 확인:

```bash
docker compose logs -f airflow-apiserver
docker compose logs -f airflow-scheduler
docker compose logs -f airflow-dag-processor
```

## 디렉터리 구조

```text
ml/
├── airflow/                  # Airflow 런타임 이미지 및 init 스크립트
├── src/
│   ├── dags/                 # Airflow runtime DAG 엔트리
│   └── pipeline/             # 실제 파이프라인 코드
│       ├── common/           # 공통 설정, artifact, context, logging
│       └── stages/           # stage 구현
└── tests/                    # pytest 테스트
    └── dags/                 # 개발/검증 전용 DAG
```

역할 구분:

- `ml/src/dags/`: Airflow runtime이 기본 mount 하는 orchestration entrypoint
- `ml/src/pipeline/stages/`: 실제 stage 처리 로직
- `ml/src/pipeline/common/`: DAG와 stage가 함께 쓰는 공통 코드
- `ml/tests/dags/`: 개발/검증 전용 DAG

## 현재 제공되는 DAG

- `dev_bootstrap`
  - artifact 디렉터리 생성과 manifest write를 확인하는 개발용 DAG
  - 기본 compose mount 대상은 아니며 `ml/tests/dags/`에서 관리
- `dev_replay`
  - retry / failed 상태를 확인하기 위한 의도적 실패 DAG
  - 기본 compose mount 대상은 아니며 `ml/tests/dags/`에서 관리
- `domain_pack_generation`
  - 현재 stage 체인을 한 번에 묶어둔 기본 개발용 DAG

## DAG 검증 방법

기본 확인은 `domain_pack_generation` 기준으로 진행합니다.

1. Airflow UI에서 `domain_pack_generation`을 찾습니다.
2. `Trigger DAG`로 수동 실행합니다.
3. 각 stage task가 순서대로 성공하는지 확인합니다.

CLI로도 검증할 수 있습니다.

```bash
docker exec init-airflow-apiserver airflow dags list
docker exec init-airflow-apiserver airflow dags test domain_pack_generation 2026-04-15
```

## artifact 규칙

artifact는 named volume 기반으로 저장합니다.

- 컨테이너 경로: `/opt/airflow/artifacts`
- 기본 규칙: `/opt/airflow/artifacts/{dag_id}/{run_id}/{stage_name}/`

공통 helper:

- `pipeline.common.config.PipelineRuntimeConfig`
- `pipeline.common.context.StageContext`
- `pipeline.common.artifacts.write_stage_manifest`
- `domain_pack_generation` DAG는 각 stage의 `artifact_manifest_path`를 XCom으로 다음 stage에 전달합니다.

새 Stage/DAG를 만들 때는 가능하면 이 helper를 재사용합니다.

## 새 DAG를 추가할 때 규칙

- 파일 위치: `ml/src/dags/*.py`
- import는 `from pipeline...` 형태를 사용합니다.
- relative import는 사용하지 않습니다.
- DAG 파일은 orchestration에만 집중하고, 실제 처리는 `ml/src/pipeline/...`로 위임합니다.
- 로컬 개발용 DAG는 `schedule=None`으로 시작하는 편이 안전합니다.
- 테스트 전용 DAG는 `ml/tests/dags/`에 두고 기본 Airflow compose mount 대상에서는 제외합니다.

예시 체크리스트:

- 파일이 `ml/src/dags/` 아래에 있는가
- Airflow 컨테이너 안 `/opt/airflow/src/dags/`에서 읽히는가
- `airflow dags list`에 보이는가
- UI에서 task 성공/실패 로그가 읽히는가

## 새 Stage를 추가할 때 규칙

- 위치: `ml/src/pipeline/stages/{stage_name}/main.py`
- 함수는 단일 책임으로 유지합니다.
- stage 간 데이터 전달은 가능한 한 XCom보다 artifact-first로 설계합니다.
- 재사용 가능한 값은 `common/`으로 올리고, 특정 stage에만 필요한 로직은 stage 내부에 둡니다.

## 자주 쓰는 명령

```bash
# ML 테스트
cd ml && uv run pytest

# 린트
cd ml && uv run ruff check .

# 포맷
cd ml && uv run ruff format .

# 타입 검사
cd ml && uv run mypy .

# Airflow DAG 목록 확인
docker exec init-airflow-apiserver airflow dags list

# 특정 DAG 테스트 실행
docker exec init-airflow-apiserver airflow dags test domain_pack_generation 2026-04-15
```

## 문제 해결

### 새 DAG가 UI에 바로 안 보일 때

먼저 DAG 목록을 확인합니다.

```bash
docker exec init-airflow-apiserver airflow dags list
```

여전히 안 보이면 parser 쪽을 재시작합니다.

```bash
docker compose restart airflow-dag-processor airflow-apiserver
```

### 초기화가 꼬였을 때

가볍게 내렸다 올리기:

```bash
docker compose down
docker compose up -d
```

볼륨까지 완전히 초기화:

```bash
docker compose down -v
docker compose up -d
```

주의:

- `down -v`는 Postgres 데이터와 Airflow 로그/artifact/auth 볼륨까지 삭제합니다.

## 협업 팁

- DAG를 추가하면 가능하면 가장 단순한 smoke-test 실행 결과까지 확인하고 공유합니다.
- 긴 로직을 DAG 파일 안에 직접 넣기보다 `src/pipeline` 쪽으로 빼서 테스트 가능하게 유지합니다.
- 로컬에서 잘 되더라도 import 경로가 bind mount 전제인지 항상 확인합니다.
- 리뷰어가 빠르게 이해할 수 있도록 “이 DAG가 무엇을 검증하는지”를 파일명과 tags에서 드러내는 편이 좋습니다.
