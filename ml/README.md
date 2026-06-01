# ML 파이프라인 개발 가이드

## 목적

- 상담 로그 기반 파이프라인 개발
- Airflow DAG 파싱, 수동 실행, 로그 확인, artifact 생성 검증
- Stage 로직과 DAG orchestration 분리

## 사전 준비

- Python `3.13+`
- `uv`
- 루트 `.env` 파일 준비
- Docker / Docker Compose v2

## 빠른 시작

ML 작업만 할 때:

저장소 루트에서:

```bash
cp .env.example .env
docker compose up -d airflow-init airflow-apiserver airflow-scheduler airflow-dag-processor
```

`ml/` 디렉터리에서:

```bash
uv sync && uv run pytest && uv run ruff check . && uv run ruff format . && uv run mypy .
```

- 위 명령으로 공유 `postgres`도 함께 기동
- backend/frontend까지 포함한 전체 스택은 루트 `README.md` 참고

## Parsed Consultation Dataset

ML 파이프라인의 기본 입력 계약은 category-free parsed consultation dataset이다.

스키마:

- `ml/schemas/parsed-consultation-dataset.schema.json`
- `ml/schemas/evaluation-pairwise-benchmark.schema.json`
- `ml/schemas/evaluation-benchmark-suite.schema.json`

로컬 개발 dataset 구조:

```text
ml/dataset/
├── training/
│   ├── 하나카드/
│   │   ├── 001.json
│   │   └── ...
│   ├── 엘지유플러스/
│   └── 액티벤처/
└── validation/
    ├── 하나카드/
    ├── 엘지유플러스/
    └── 액티벤처/
```

파일 구조:

```json
[
  {
    "source_id": "90001",
    "turns": [
      {
        "turn_index": 0,
        "speaker_role": "CUSTOMER",
        "message_text": "상담 발화"
      }
    ]
  }
]
```

입력에 포함하지 않는 필드:

- `consulting_category`
- `consulting_content`
- `source`
- `client_gender`
- `client_age`
- `consulting_date`
- `consulting_turns`
- `consulting_length`

원본 raw source에서 로컬 parsed dataset을 재생성할 때:

```bash
cd ml
uv run python scripts/build_parsed_dataset.py \
  /Users/owen/Projects/school/5stone-poc/data/raw \
  dataset \
  --clean
```

특정 회사 training set으로 로컬 파이프라인을 실행할 때:

```bash
cd ml
uv run python scripts/run_local_pipeline.py dataset/training/하나카드 --max-files 30
```

validation set은 생성된 workflow가 holdout 상담을 얼마나 잘 처리하는지 확인하는 개발용 샘플로 사용한다.

```bash
cd ml
uv run python scripts/run_local_pipeline.py dataset/validation/하나카드 --max-files 30
```

오프라인 평가 정답은 pipeline input에 섞지 않고 별도 benchmark 파일로만 둔다. 기본 pairwise benchmark는 `must_link`/`cannot_link` 관계만 담고, `consulting_category`나 category label은 평가 신호로 사용하지 않는다.

```json
{
  "schemaVersion": "evaluation-pairwise-benchmark.v1",
  "pairs": [
    {
      "sourceCaseletId": "caselet-a",
      "targetCaseletId": "caselet-b",
      "relation": "must_link"
    },
    {
      "sourceCaseletId": "caselet-a",
      "targetCaseletId": "caselet-c",
      "relation": "cannot_link"
    }
  ]
}
```

더 엄밀한 오프라인 평가는 category-free benchmark suite로 확장한다. suite는 pipeline input이 아니며, boundary, intent pair, label object/action, workflow event/variant gold를 분리해서 담는다.

```json
{
  "schemaVersion": "evaluation-benchmark-suite.v1",
  "boundaryCases": [
    {
      "conversationId": "conv-001",
      "expectedCaselets": [
        {
          "turnStart": 0,
          "turnEnd": 3,
          "issueObject": "결제수단",
          "issueAction": "변경"
        }
      ]
    }
  ],
  "intentPairs": [
    {
      "sourceCaseletId": "caselet-a",
      "targetCaseletId": "caselet-b",
      "relation": "same_intent"
    },
    {
      "sourceCaseletId": "caselet-a",
      "targetCaseletId": "caselet-c",
      "relation": "different_intent_same_object"
    }
  ],
  "labelExpectations": [
    {
      "clusterGoldId": "G001",
      "object": "결제수단",
      "action": "변경",
      "allowedLabels": ["결제수단 변경 문의"],
      "forbiddenTerms": ["수고했습니다", "여기"]
    }
  ],
  "workflowExpectations": [
    {
      "caseletId": "caselet-a",
      "expectedEvents": ["USER_REQUEST", "SLOT_COLLECTION", "RESOLUTION"],
      "workflowVariant": "slot_collection_then_resolution"
    }
  ]
}
```

Airflow manifest payload 또는 환경 변수로 전달할 수 있다.

```text
evaluationBenchmarkPath
PIPELINE_EVALUATION_BENCHMARK_PATH
```

production ingestion은 같은 parsed JSON 파일들을 담은 zip archive도 입력으로 받는다. Backend/Airflow는 S3 object key 하나를 넘기고, ML ingestion stage가 archive 내부의 `.json`/`.jsonl` 파일을 읽는다.

zip archive를 로컬에서 smoke test할 때:

```bash
cd ml
uv run python scripts/run_local_pipeline.py dataset/archives/training-flat/하나카드_training_parsed_flat.zip
```

`ml/dataset/`은 로컬 대용량 데이터 영역이므로 git에 올리지 않는다.

## Airflow 로컬 실행

- 기준 파일: 루트 `docker-compose.yml`, `ml/docker-compose.yml`
- UI: `http://localhost:8081`
- 관리자 계정: `admin / admin`
- 조회 전용 계정: `viewer / viewer`
- metadata DB: 루트 `postgres` 서비스의 `init` DB / `init` 계정 사용
- ML 관련 서비스만 올려도 Airflow가 쓰는 공유 `postgres` 함께 기동
- 루트 `docker-compose.yml`에서 `ml/docker-compose.yml` include

Airflow 컨테이너:

- `airflow-init`
- `airflow-apiserver`
- `airflow-scheduler`
- `airflow-dag-processor`

Mac host GPU로 embedding을 처리할 때:

```bash
cd ml
uv run python -m pipeline.local_embedder_server
```

다른 터미널에서 저장소 루트 기준:

```bash
docker compose -f docker-compose.yml -f ml/docker-compose.local-embedder.yml up -d \
  airflow-init airflow-apiserver airflow-scheduler airflow-dag-processor
```

- Airflow 컨테이너는 `host.docker.internal:18090`으로 embedding 요청만 전달한다.
- host worker는 `torch.backends.mps.is_available()`이면 BGE-M3를 `devices="mps"`로 로드한다.
- 강제로 장치를 지정하려면 host worker 실행 전에 `EMBEDDING_DEVICE=mps` 또는 `EMBEDDING_DEVICE=cpu`를 설정한다.

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

역할:

- `ml/src/dags/`: orchestration entrypoint
- `ml/src/pipeline/stages/`: stage 처리 로직
- `ml/src/pipeline/common/`: 공통 코드
- `ml/tests/dags/`: 개발/검증 전용 DAG

## 현재 제공되는 DAG

Runtime DAG:

- `ml/src/dags/domain_pack_generation.py`: 현재 stage 체인을 묶은 기본 개발용 DAG

Test-only DAG:

- `ml/tests/dags/dev_bootstrap.py`: artifact 디렉터리 생성, manifest write 확인용 테스트 DAG
- `ml/tests/dags/dev_replay.py`: retry / failed 상태 확인용 의도적 실패 테스트 DAG

## DAG 검증

기본 대상:

- `ml/src/dags/domain_pack_generation.py`

UI 확인:

1. Airflow UI에서 `domain_pack_generation` 확인
2. `Trigger DAG` 실행
3. stage task 순차 성공 여부 확인

CLI 확인:

```bash
docker compose exec airflow-apiserver airflow dags list
docker compose exec airflow-apiserver airflow dags test domain_pack_generation 2026-04-15
```

## Artifact 규칙

- 저장소: named volume
- 컨테이너 경로: `/opt/airflow/artifacts`
- 경로 규칙: `/opt/airflow/artifacts/{dag_id}/{safe_run_id}/{stage_name}/`
- `safe_run_id`: `run_id`의 `/`를 `__`로 치환한 값

공통 helper:

- `pipeline.common.config.PipelineRuntimeConfig`
- `pipeline.common.context.StageContext`
- `pipeline.common.artifacts.write_stage_manifest`

## 새 DAG 추가 규칙

- 위치: `ml/src/dags/*.py`
- import: `from pipeline...`
- relative import 금지
- DAG 파일은 orchestration만 담당
- 실제 처리는 `ml/src/pipeline/...`로 위임
- 로컬 개발용 DAG는 `schedule=None` 권장
- 테스트 전용 DAG는 `ml/tests/dags/`에 두고 기본 mount 대상에서 제외

체크리스트:

- `ml/src/dags/` 아래에 있는가
- 컨테이너 안 `/opt/airflow/src/dags/`에서 읽히는가
- `airflow dags list`에 보이는가
- UI에서 task 로그가 읽히는가

## 새 Stage 추가 규칙

- 위치: `ml/src/pipeline/stages/{stage_name}/main.py`
- 단일 책임 유지
- stage 간 데이터 전달은 artifact-first 우선
- 재사용 값은 `common/`으로 승격

## 자주 쓰는 명령

`ml/` 디렉터리에서:

```bash
# ML 검사
uv run pytest && uv run ruff check . && uv run ruff format . && uv run mypy .
```

저장소 루트에서:

```bash
# Airflow DAG 목록 확인
docker compose exec airflow-apiserver airflow dags list

# 특정 DAG 테스트 실행
docker compose exec airflow-apiserver airflow dags test domain_pack_generation 2026-04-15
```

## 문제 해결

새 DAG가 UI에 바로 안 보일 때:

```bash
docker compose exec airflow-apiserver airflow dags list
docker compose restart airflow-dag-processor airflow-apiserver
```

Airflow 서비스만 다시 올릴 때:

```bash
docker compose stop airflow-apiserver airflow-scheduler airflow-dag-processor
docker compose up -d airflow-init airflow-apiserver airflow-scheduler airflow-dag-processor
```

Airflow 관련 volume까지 초기화할 때:

```bash
docker compose stop airflow-apiserver airflow-scheduler airflow-dag-processor
docker compose rm -sf airflow-init airflow-apiserver airflow-scheduler airflow-dag-processor
docker volume rm ostone_airflow_logs ostone_airflow_artifacts ostone_airflow_auth
docker compose up -d airflow-init airflow-apiserver airflow-scheduler airflow-dag-processor
```

주의:

- 위 volume 이름은 기본 Compose project name `ostone` 기준
- 다른 project name을 쓰면 실제 volume 이름 확인 후 동일 방식 적용
- 공유 `postgres`까지 초기화하려면 루트 `README.md` 참고

## 협업 팁

- DAG 추가 시 smoke-test 결과까지 확인
- 긴 로직은 `src/pipeline`으로 분리
- import 경로가 bind mount 전제인지 확인
- DAG 목적이 파일명과 tags에서 드러나게 유지
