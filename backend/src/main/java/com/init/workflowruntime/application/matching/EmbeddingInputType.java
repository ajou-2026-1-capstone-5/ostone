package com.init.workflowruntime.application.matching;

public enum EmbeddingInputType {
  SEARCH_DOCUMENT("search_document"),
  SEARCH_QUERY("search_query");

  private final String wireValue;

  EmbeddingInputType(String wireValue) {
    this.wireValue = wireValue;
  }

  public String wireValue() {
    return wireValue;
  }
}
