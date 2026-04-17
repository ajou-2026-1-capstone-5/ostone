package com.init.corpus.infrastructure.airflow;

import com.init.corpus.application.port.IngestionTriggerPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * 임시 NOOP 구현. Airflow DAG payload 확정 후 실제 구현으로 교체 필요.
 *
 * <p>TODO: spec/114 U-08 — Airflow ingestion trigger payload 미확정
 */
@Component
public class AirflowIngestionTriggerAdapter implements IngestionTriggerPort {

  private static final Logger log = LoggerFactory.getLogger(AirflowIngestionTriggerAdapter.class);

  @Override
  public void trigger(Long datasetId, String objectKey) {
    log.info(
        "[NOOP] Airflow ingestion trigger skipped (not implemented). datasetId={}, objectKey={}",
        datasetId,
        objectKey);
  }
}
