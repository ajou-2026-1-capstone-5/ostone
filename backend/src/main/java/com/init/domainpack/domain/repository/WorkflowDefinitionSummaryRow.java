package com.init.domainpack.domain.repository;

import java.time.OffsetDateTime;

public interface WorkflowDefinitionSummaryRow {
  Long getId();

  Long getDomainPackVersionId();

  Long getIntentDefinitionId();

  String getWorkflowCode();

  String getName();

  String getDescription();

  String getInitialState();

  String getTerminalStatesJson();

  OffsetDateTime getCreatedAt();

  OffsetDateTime getUpdatedAt();
}
