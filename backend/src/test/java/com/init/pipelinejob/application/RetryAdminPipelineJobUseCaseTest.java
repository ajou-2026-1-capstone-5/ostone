package com.init.pipelinejob.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.pipelinejob.application.exception.PipelineJobRetryInputMissingException;
import com.init.pipelinejob.application.exception.PipelineJobRetryNotAllowedException;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import java.lang.reflect.Constructor;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("RetryAdminPipelineJobUseCase")
class RetryAdminPipelineJobUseCaseTest {

  @Mock private PipelineJobRepository pipelineJobRepository;
  @Mock private TriggerDomainPackGenerationUseCase triggerDomainPackGenerationUseCase;

  private RetryAdminPipelineJobUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase =
        new RetryAdminPipelineJobUseCase(
            pipelineJobRepository, triggerDomainPackGenerationUseCase, new ObjectMapper());
  }

  @Test
  @DisplayName("FAILED Domain Pack generation job이면 원본 objectKey로 새 run을 생성한다")
  void execute_failedDomainPackJob_reusesOriginalObjectKey() {
    PipelineJob sourceJob =
        pipelineJob(
            11L,
            PipelineJob.JOB_TYPE_DOMAIN_PACK_GENERATION,
            PipelineJob.STATUS_FAILED,
            """
            {"objectKey":"workspaces/1/datasets/7/raw.json"}
            """);
    given(pipelineJobRepository.findById(11L)).willReturn(Optional.of(sourceJob));
    given(triggerDomainPackGenerationUseCase.execute(any()))
        .willReturn(
            new TriggerDomainPackGenerationResult(
                12L,
                1L,
                7L,
                PipelineJob.JOB_TYPE_DOMAIN_PACK_GENERATION,
                PipelineJob.STATUS_RUNNING,
                "domain_pack_generation",
                "pipeline_job_12",
                OffsetDateTime.parse("2026-06-03T02:00:00Z"),
                OffsetDateTime.parse("2026-06-03T02:00:01Z")));

    RetryAdminPipelineJobResult result = useCase.execute(11L, 99L);

    assertThat(result.sourcePipelineJobId()).isEqualTo(11L);
    assertThat(result.retryPipelineJobId()).isEqualTo(12L);
    verify(triggerDomainPackGenerationUseCase).execute(commandCaptor.capture());
    TriggerDomainPackGenerationCommand command = commandCaptor.getValue();
    assertThat(command.workspaceId()).isEqualTo(1L);
    assertThat(command.datasetId()).isEqualTo(7L);
    assertThat(command.userId()).isEqualTo(99L);
    assertThat(command.rawFileObjectKey()).isEqualTo("workspaces/1/datasets/7/raw.json");
    assertThat(command.retriedFromPipelineJobId()).isEqualTo(11L);
    assertThat(command.enforceWorkspaceRole()).isFalse();
  }

  @Test
  @DisplayName("FAILED가 아니면 재시도를 거부한다")
  void execute_nonFailed_throwsNotAllowed() {
    given(pipelineJobRepository.findById(11L))
        .willReturn(
            Optional.of(
                pipelineJob(
                    11L,
                    PipelineJob.JOB_TYPE_DOMAIN_PACK_GENERATION,
                    PipelineJob.STATUS_RUNNING,
                    "{}")));

    assertThatThrownBy(() -> useCase.execute(11L, 99L))
        .isInstanceOf(PipelineJobRetryNotAllowedException.class);
  }

  @Test
  @DisplayName("원본 objectKey가 없으면 입력 누락 오류를 반환한다")
  void execute_missingObjectKey_throwsInputMissing() {
    given(pipelineJobRepository.findById(11L))
        .willReturn(
            Optional.of(
                pipelineJob(
                    11L,
                    PipelineJob.JOB_TYPE_DOMAIN_PACK_GENERATION,
                    PipelineJob.STATUS_FAILED,
                    "{}")));

    assertThatThrownBy(() -> useCase.execute(11L, 99L))
        .isInstanceOf(PipelineJobRetryInputMissingException.class);
  }

  private final ArgumentCaptor<TriggerDomainPackGenerationCommand> commandCaptor =
      ArgumentCaptor.forClass(TriggerDomainPackGenerationCommand.class);

  private PipelineJob pipelineJob(
      Long id, String jobType, String status, String requestPayloadJson) {
    PipelineJob job = newPipelineJob();
    ReflectionTestUtils.setField(job, "id", id);
    ReflectionTestUtils.setField(job, "workspaceId", 1L);
    ReflectionTestUtils.setField(job, "datasetId", 7L);
    ReflectionTestUtils.setField(job, "jobType", jobType);
    ReflectionTestUtils.setField(job, "status", status);
    ReflectionTestUtils.setField(job, "requestPayloadJson", requestPayloadJson);
    ReflectionTestUtils.setField(job, "resultSummaryJson", "{}");
    ReflectionTestUtils.setField(job, "requestedAt", OffsetDateTime.parse("2026-06-03T01:00:00Z"));
    return job;
  }

  private PipelineJob newPipelineJob() {
    try {
      Constructor<PipelineJob> constructor = PipelineJob.class.getDeclaredConstructor();
      constructor.setAccessible(true);
      return constructor.newInstance();
    } catch (ReflectiveOperationException ex) {
      throw new RuntimeException("PipelineJob 테스트 인스턴스 생성 실패", ex);
    }
  }
}
