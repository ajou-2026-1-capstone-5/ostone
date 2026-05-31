package com.init.pipelinejob.presentation.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PipelineReviewCheckpointCallbackRequest(
    @NotBlank(message = "externalEventId는 필수입니다.")
        @Size(max = 255, message = "externalEventId는 255자 이하여야 합니다.")
        String externalEventId,
    @Size(max = 255, message = "dagId는 255자 이하여야 합니다.") String dagId,
    @Size(max = 255, message = "dagRunId는 255자 이하여야 합니다.") String dagRunId,
    @Size(max = 100, message = "runMode는 100자 이하여야 합니다.") String runMode,
    String parentPipelineJobId,
    String upstreamManifestPath,
    String domainCandidatesPath,
    String feedbackQuestionsPath,
    JsonNode domainCandidates,
    JsonNode feedbackQuestions) {}
