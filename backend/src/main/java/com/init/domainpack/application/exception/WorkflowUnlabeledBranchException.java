package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class WorkflowUnlabeledBranchException extends BadRequestException {
  public WorkflowUnlabeledBranchException(String workflowCode) {
    super(
        "WORKFLOW_UNLABELED_BRANCH",
        "DECISION 노드의 모든 outgoing edge에 label이 필요합니다. workflowCode=" + workflowCode);
  }
}
