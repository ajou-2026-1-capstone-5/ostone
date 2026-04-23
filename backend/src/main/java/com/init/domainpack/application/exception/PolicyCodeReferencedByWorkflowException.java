package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class PolicyCodeReferencedByWorkflowException extends BadRequestException {

  public PolicyCodeReferencedByWorkflowException(String policyCode) {
    super(
        "POLICY_CODE_REFERENCED_BY_WORKFLOW",
        "해당 정책 코드를 참조하는 워크플로우가 존재하여 비활성화할 수 없습니다.");
  }
}
