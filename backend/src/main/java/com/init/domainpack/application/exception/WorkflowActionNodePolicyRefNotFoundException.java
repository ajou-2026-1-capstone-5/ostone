package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class WorkflowActionNodePolicyRefNotFoundException extends BadRequestException {
  public WorkflowActionNodePolicyRefNotFoundException(String policyRef) {
    super(
        "WORKFLOW_ACTION_NODE_POLICY_REF_NOT_FOUND",
        "ACTION 타입 노드의 policyRef가 존재하지 않습니다. policyRef=" + policyRef);
  }
}
