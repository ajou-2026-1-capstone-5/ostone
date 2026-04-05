def test_should_import_all_stages():
    from pipeline.stages.ingestion.main import run as ingestion_run
    from pipeline.stages.preprocessing.main import run as preprocessing_run
    from pipeline.stages.intent_discovery.main import run as intent_discovery_run
    from pipeline.stages.draft_generation.main import run as draft_generation_run
    from pipeline.stages.evaluation.main import run as evaluation_run
    from pipeline.stages.publish_candidate.main import run as publish_candidate_run

    assert callable(ingestion_run)
    assert callable(preprocessing_run)
    assert callable(intent_discovery_run)
    assert callable(draft_generation_run)
    assert callable(evaluation_run)
    assert callable(publish_candidate_run)
