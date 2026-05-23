package com.init.workflowruntime.domain;

public final class DecisionLogType {

  public static final String INTENT_SELECTED = "INTENT_SELECTED";
  public static final String SLOT_UPSERTED = "SLOT_UPSERTED";
  public static final String WORKFLOW_FETCHED = "WORKFLOW_FETCHED";
  public static final String CONTEXT_FETCHED = "CONTEXT_FETCHED";
  public static final String SLOTS_LISTED = "SLOTS_LISTED";
  public static final String SLOT_FETCHED = "SLOT_FETCHED";
  public static final String INTENTS_LISTED = "INTENTS_LISTED";

  private DecisionLogType() {}
}
