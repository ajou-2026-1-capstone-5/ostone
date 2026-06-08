import pytest

AIRFLOW_OPTIONAL_REASON = (
    "Airflow SDK is optional in lightweight ML test environments; CI DAG behavior is covered by mocked DAG tests."
)


def test_ci_path_imports_all_stage_entrypoints_without_airflow_dependency():
    from pipeline.stages.draft_generation.main import run as draft_generation_run
    from pipeline.stages.evaluation.main import run as evaluation_run
    from pipeline.stages.ingestion.main import run as ingestion_run
    from pipeline.stages.intent_discovery.main import run as intent_discovery_run
    from pipeline.stages.preprocessing.main import run as preprocessing_run
    from pipeline.stages.publish_candidate.main import run as publish_candidate_run

    assert callable(ingestion_run)
    assert callable(preprocessing_run)
    assert callable(intent_discovery_run)
    assert callable(draft_generation_run)
    assert callable(evaluation_run)
    assert callable(publish_candidate_run)


def test_optional_airflow_runtime_dag_import_smoke_when_airflow_sdk_is_installed():
    pytest.importorskip(
        "airflow.sdk",
        reason=AIRFLOW_OPTIONAL_REASON,
    )

    from dags.domain_pack_generation import domain_pack_generation

    assert callable(domain_pack_generation)


def test_optional_airflow_dev_dag_import_smoke_when_airflow_sdk_is_installed():
    pytest.importorskip(
        "airflow.sdk",
        reason=AIRFLOW_OPTIONAL_REASON,
    )

    from tests.dags.dev_bootstrap import dev_bootstrap
    from tests.dags.dev_replay import dev_replay

    assert callable(dev_bootstrap)
    assert callable(dev_replay)
