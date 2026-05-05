package com.init.pipelinejob.application;

public interface DomainPackGenerationTriggerPort {

  String dagId();

  DomainPackGenerationTriggerResult trigger(DomainPackGenerationTriggerCommand command);
}
