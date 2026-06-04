package com.init.workflowruntime.presentation.dto;

public enum SimulationFeedbackTypeRequest {
  INTENT_MISMATCH,
  MISSING_SLOT_QUESTION,
  INAPPROPRIATE_RESPONSE,
  POLICY_CONDITION_MISSING,
  RISK_HANDOFF_REQUIRED,
  WORKFLOW_BRANCH_ERROR,
  OTHER
}
