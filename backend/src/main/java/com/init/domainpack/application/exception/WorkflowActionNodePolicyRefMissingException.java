package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class WorkflowActionNodePolicyRefMissingException extends BadRequestException {
  public WorkflowActionNodePolicyRefMissingException(String workflowCode) {
    super(
        "WORKFLOW_ACTION_NODE_POLICY_REF_MISSING",
        "ACTION 타입 노드에 policyRef가 필요합니다. workflowCode=" + workflowCode);
  }

  public WorkflowActionNodePolicyRefMissingException(Long workflowId, String nodeId) {
    super(
        "WORKFLOW_ACTION_NODE_POLICY_REF_MISSING",
        "ACTION 타입 노드에 policyRef가 필요합니다. workflowId=" + workflowId + ", nodeId=" + nodeId);
  }
}
