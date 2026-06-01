package com.init.workflowruntime.application.exception;

import com.init.shared.application.exception.DuplicateException;
import com.init.workflowruntime.application.AiResponseGenerationGuard;

public class AiResponseInProgressException extends DuplicateException {

  public AiResponseInProgressException() {
    super(
        AiResponseGenerationGuard.IN_PROGRESS_CODE, AiResponseGenerationGuard.IN_PROGRESS_MESSAGE);
  }
}
