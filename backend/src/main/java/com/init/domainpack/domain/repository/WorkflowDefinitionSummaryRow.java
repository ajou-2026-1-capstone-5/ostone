package com.init.domainpack.domain.repository;

import java.time.OffsetDateTime;

public interface WorkflowDefinitionSummaryRow {
  Long getId();

  String getWorkflowCode();

  String getName();

  String getDescription();

  String getInitialState();

  String getTerminalStatesJson();

  OffsetDateTime getCreatedAt();

  OffsetDateTime getUpdatedAt();
}
