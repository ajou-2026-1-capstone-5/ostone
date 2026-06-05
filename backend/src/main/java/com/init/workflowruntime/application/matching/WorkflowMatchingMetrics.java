package com.init.workflowruntime.application.matching;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Component;

@Component
public class WorkflowMatchingMetrics {

  private final MeterRegistry meterRegistry;

  public WorkflowMatchingMetrics(MeterRegistry meterRegistry) {
    this.meterRegistry = meterRegistry;
  }

  public Timer.Sample startMatchTimer() {
    return Timer.start(meterRegistry);
  }

  public void stopMatchTimer(Timer.Sample sample) {
    sample.stop(meterRegistry.timer("workflow_matching.match.latency"));
  }

  public void recordInsufficientContext() {
    meterRegistry.counter("workflow_matching.insufficient_context").increment();
    recordResult("UNKNOWN");
  }

  public void recordProfileMissing() {
    meterRegistry.counter("workflow_matching.profile_missing").increment();
  }

  public void recordResult(String status) {
    meterRegistry.counter("workflow_matching.result", "status", status).increment();
  }
}
