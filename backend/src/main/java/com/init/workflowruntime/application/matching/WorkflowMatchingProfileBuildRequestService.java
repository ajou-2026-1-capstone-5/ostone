package com.init.workflowruntime.application.matching;

import com.init.workflowruntime.infrastructure.persistence.WorkflowMatchingProfileBuildJdbcRepository;
import org.springframework.stereotype.Service;

@Service
public class WorkflowMatchingProfileBuildRequestService {

  private final WorkflowMatchingProfileBuildJdbcRepository buildRepository;

  public WorkflowMatchingProfileBuildRequestService(
      WorkflowMatchingProfileBuildJdbcRepository buildRepository) {
    this.buildRepository = buildRepository;
  }

  public void enqueue(Long domainPackVersionId, String triggerType) {
    if (domainPackVersionId == null) {
      return;
    }
    buildRepository.enqueue(domainPackVersionId, triggerType);
  }
}
