package com.init.workflowruntime.application.matching;

public class EmbeddingDisabledException extends RuntimeException {

  public EmbeddingDisabledException() {
    super("Embedding provider is disabled");
  }
}
