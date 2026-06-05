package com.init.workflowruntime.application.matching;

import java.util.List;

public record WorkflowMatchingEvaluation(
    WorkflowMatchResult result, List<WorkflowMatchCandidate> rankedCandidates) {}
