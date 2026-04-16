package com.init.corpus.application.port;

public interface IngestionTriggerPort {

  /** Airflow ingestion 파이프라인을 트리거한다. payload 스펙은 uncertainty-register-114.md U-08 참조. */
  void trigger(Long datasetId, String objectKey);
}
