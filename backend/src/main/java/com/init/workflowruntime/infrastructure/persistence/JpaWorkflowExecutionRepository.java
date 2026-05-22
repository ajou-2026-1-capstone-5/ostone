package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.domain.WorkflowExecution;
import com.init.workflowruntime.domain.WorkflowExecutionRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaWorkflowExecutionRepository
    extends JpaRepository<WorkflowExecution, Long>, WorkflowExecutionRepository {}
