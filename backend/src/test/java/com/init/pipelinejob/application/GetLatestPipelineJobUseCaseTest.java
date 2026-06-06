package com.init.pipelinejob.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import java.lang.reflect.Constructor;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("GetLatestPipelineJobUseCase")
class GetLatestPipelineJobUseCaseTest {

  @Mock private PipelineJobRepository pipelineJobRepository;
  @Mock private WorkspaceMembershipPort workspaceMembershipPort;
  @Mock private DatasetOwnershipPort datasetOwnershipPort;

  private GetLatestPipelineJobUseCase useCase;
  private final Clock fixedClock =
      Clock.fixed(Instant.parse("2026-06-05T01:10:00Z"), ZoneOffset.UTC);

  @BeforeEach
  void setUp() {
    useCase =
        new GetLatestPipelineJobUseCase(
            pipelineJobRepository, workspaceMembershipPort, datasetOwnershipPort, fixedClock);
  }

  @Test
  @DisplayName("멤버가 데이터셋의 최신 ingestion job을 조회한다")
  void execute_member_returnsLatestIngestionJob() {
    PipelineJob job = pipelineJob();
    given(workspaceMembershipPort.existsById(2L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(2L, 9L, Set.of("OWNER", "ADMIN", "OPERATOR")))
        .willReturn(true);
    given(datasetOwnershipPort.existsByIdAndWorkspaceId(15L, 2L)).willReturn(true);
    given(
            pipelineJobRepository.findLatestByWorkspaceIdAndDatasetIdAndJobType(
                2L, 15L, PipelineJob.JOB_TYPE_INGESTION))
        .willReturn(Optional.of(job));

    Optional<GetLatestPipelineJobResult> result =
        useCase.execute(new GetLatestPipelineJobQuery(2L, 15L, null, 9L));

    assertThat(result).isPresent();
    assertThat(result.orElseThrow().pipelineJobId()).isEqualTo(77L);
    assertThat(result.orElseThrow().jobType()).isEqualTo(PipelineJob.JOB_TYPE_INGESTION);
    assertThat(result.orElseThrow().runningDurationSeconds()).isEqualTo(540);
  }

  @Test
  @DisplayName("job이 아직 생성되지 않았으면 빈 결과를 반환한다")
  void execute_noJob_returnsEmpty() {
    given(workspaceMembershipPort.existsById(2L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(2L, 9L, Set.of("OWNER", "ADMIN", "OPERATOR")))
        .willReturn(true);
    given(datasetOwnershipPort.existsByIdAndWorkspaceId(15L, 2L)).willReturn(true);
    given(
            pipelineJobRepository.findLatestByWorkspaceIdAndDatasetIdAndJobType(
                2L, 15L, PipelineJob.JOB_TYPE_INGESTION))
        .willReturn(Optional.empty());

    Optional<GetLatestPipelineJobResult> result =
        useCase.execute(new GetLatestPipelineJobQuery(2L, 15L, "INGESTION", 9L));

    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("워크스페이스 멤버가 아니면 데이터셋을 숨긴다")
  void execute_nonMember_throwsNotFound() {
    given(workspaceMembershipPort.existsById(2L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(2L, 9L, Set.of("OWNER", "ADMIN", "OPERATOR")))
        .willReturn(false);

    assertThatThrownBy(
            () -> useCase.execute(new GetLatestPipelineJobQuery(2L, 15L, "INGESTION", 9L)))
        .isInstanceOf(NotFoundException.class)
        .hasMessageContaining("Dataset");
  }

  @Test
  @DisplayName("지원하지 않는 jobType이면 BadRequestException을 던진다")
  void execute_invalidJobType_throwsBadRequest() {
    assertThatThrownBy(
            () -> useCase.execute(new GetLatestPipelineJobQuery(2L, 15L, "UNKNOWN_TYPE", 9L)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("지원하지 않는 pipeline job type입니다.");
  }

  @Test
  @DisplayName("필수 조회 값이 없으면 BadRequestException을 던진다")
  void execute_missingRequiredQueryValue_throwsBadRequest() {
    assertThatThrownBy(
            () -> useCase.execute(new GetLatestPipelineJobQuery(null, 15L, "INGESTION", 9L)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("pipeline job 조회 요청 값이 올바르지 않습니다.");
  }

  private PipelineJob pipelineJob() {
    PipelineJob job = newPipelineJob();
    ReflectionTestUtils.setField(job, "id", 77L);
    ReflectionTestUtils.setField(job, "workspaceId", 2L);
    ReflectionTestUtils.setField(job, "datasetId", 15L);
    ReflectionTestUtils.setField(job, "jobType", PipelineJob.JOB_TYPE_INGESTION);
    ReflectionTestUtils.setField(job, "status", PipelineJob.STATUS_RUNNING);
    ReflectionTestUtils.setField(job, "airflowDagId", "domain_pack_generation");
    ReflectionTestUtils.setField(job, "airflowRunId", "pipeline_job_77");
    ReflectionTestUtils.setField(job, "requestPayloadJson", "{}");
    ReflectionTestUtils.setField(job, "resultSummaryJson", "{}");
    ReflectionTestUtils.setField(job, "requestedAt", OffsetDateTime.parse("2026-06-05T01:00:00Z"));
    ReflectionTestUtils.setField(job, "startedAt", OffsetDateTime.parse("2026-06-05T01:01:00Z"));
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
