package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class WorkflowActionNodePolicyRefInvalidCharsException extends BadRequestException {
  public WorkflowActionNodePolicyRefInvalidCharsException(String workflowCode) {
    super(
        "WORKFLOW_ACTION_NODE_POLICY_REF_INVALID_CHARS",
        "ACTION 타입 노드의 policyRef가 유효하지 않은 문자를 포함합니다. workflowCode=" + workflowCode);
  }

  public WorkflowActionNodePolicyRefInvalidCharsException(Long workflowId, String nodeId) {
    super(
        "WORKFLOW_ACTION_NODE_POLICY_REF_INVALID_CHARS",
        "ACTION 타입 노드의 policyRef가 유효하지 않은 문자를 포함합니다. workflowId="
            + workflowId
            + ", nodeId="
            + nodeId);
  }
}
