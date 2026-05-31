package com.init.workflowruntime.application.matching;

public interface EmbeddingClient {

  float[] embed(String text, EmbeddingInputType inputType);
}
