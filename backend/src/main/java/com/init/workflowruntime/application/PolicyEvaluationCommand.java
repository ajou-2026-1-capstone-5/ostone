package com.init.workflowruntime.application;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.workflowruntime.application.WorkflowRuntimeGraph.RuntimeNode;
import com.init.workflowruntime.domain.WorkflowExecution;

record PolicyEvaluationCommand(
    Long domainPackVersionId,
    RuntimeNode node,
    ObjectNode slotValues,
    WorkflowExecution execution) {}
