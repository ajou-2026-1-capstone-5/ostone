package com.init.pipelinejob.application;

public interface IngestionAirflowTriggerPort {

  String dagId();

  void trigger(IngestionTriggerCommand command);
}
