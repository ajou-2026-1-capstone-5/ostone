package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.domain.WorkflowExecutionStep;
import com.init.workflowruntime.domain.WorkflowExecutionStepRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaWorkflowExecutionStepRepository
    extends JpaRepository<WorkflowExecutionStep, Long>, WorkflowExecutionStepRepository {}
