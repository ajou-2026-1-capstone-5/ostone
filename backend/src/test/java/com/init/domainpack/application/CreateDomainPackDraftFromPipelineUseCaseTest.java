package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

import com.init.domainpack.domain.model.DomainPack;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackCommandRepository;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("CreateDomainPackDraftFromPipelineUseCase")
class CreateDomainPackDraftFromPipelineUseCaseTest {

  @Mock private DomainPackCommandRepository domainPackCommandRepository;
  @Mock private DomainPackDraftPersistenceService domainPackDraftPersistenceService;
  @InjectMocks private CreateDomainPackDraftFromPipelineUseCase useCase;

  @Test
  @DisplayName("기존 pack이 있으면 재사용하고 DRAFT 버전을 생성한다")
  void execute_existingPack_reusesPack() {
    DomainPack existingPack = DomainPack.create(3L, "refund-pack", "환불 Pack", null, null);
    ReflectionTestUtils.setField(existingPack, "id", 7L);
    DomainPackVersion version = DomainPackVersion.ofForTest(101L, 7L, "DRAFT");
    ReflectionTestUtils.setField(version, "versionNo", 3);
    ReflectionTestUtils.setField(version, "sourcePipelineJobId", 11L);

    given(domainPackCommandRepository.findByWorkspaceIdAndPackKey(3L, "refund-pack"))
        .willReturn(Optional.of(existingPack));
    given(domainPackDraftPersistenceService.persistVersion(7L, null, 11L, "{\"summary\":\"test\"}"))
        .willReturn(version);

    CreateDomainPackDraftFromPipelineResult result =
        useCase.execute(
            new CreateDomainPackDraftFromPipelineCommand(
                3L, "refund-pack", "환불 Pack", 11L, "{\"summary\":\"test\"}"));

    assertThat(result.domainPackId()).isEqualTo(7L);
    assertThat(result.domainPackVersionId()).isEqualTo(101L);
    assertThat(result.versionNo()).isEqualTo(3);
    assertThat(result.createdPack()).isFalse();
  }

  @Test
  @DisplayName("pack이 없으면 새로 생성한 뒤 DRAFT 버전을 생성한다")
  void execute_noPack_createsNewPack() {
    DomainPack newPack = DomainPack.create(3L, "refund-pack", "환불 Pack", null, null);
    ReflectionTestUtils.setField(newPack, "id", 7L);
    DomainPackVersion version = DomainPackVersion.ofForTest(101L, 7L, "DRAFT");
    ReflectionTestUtils.setField(version, "versionNo", 1);
    ReflectionTestUtils.setField(version, "sourcePipelineJobId", 11L);

    given(domainPackCommandRepository.findByWorkspaceIdAndPackKey(3L, "refund-pack"))
        .willReturn(Optional.empty());
    given(domainPackCommandRepository.saveAndFlush(any())).willReturn(newPack);
    given(domainPackDraftPersistenceService.persistVersion(7L, null, 11L, null))
        .willReturn(version);

    CreateDomainPackDraftFromPipelineResult result =
        useCase.execute(
            new CreateDomainPackDraftFromPipelineCommand(3L, "refund-pack", "환불 Pack", 11L, null));

    assertThat(result.domainPackId()).isEqualTo(7L);
    assertThat(result.createdPack()).isTrue();
    assertThat(result.versionNo()).isEqualTo(1);
  }

  @Test
  @DisplayName("pack 생성 경쟁 시 재조회 후 기존 pack을 사용한다")
  void execute_raceCondition_requeriesExistingPack() {
    DomainPack existingPack = DomainPack.create(3L, "refund-pack", "환불 Pack", null, null);
    ReflectionTestUtils.setField(existingPack, "id", 7L);
    DomainPackVersion version = DomainPackVersion.ofForTest(101L, 7L, "DRAFT");
    ReflectionTestUtils.setField(version, "versionNo", 1);
    ReflectionTestUtils.setField(version, "sourcePipelineJobId", 11L);

    given(domainPackCommandRepository.findByWorkspaceIdAndPackKey(3L, "refund-pack"))
        .willReturn(Optional.empty(), Optional.of(existingPack));
    given(domainPackCommandRepository.saveAndFlush(any()))
        .willThrow(new DataIntegrityViolationException("unique violation"));
    given(domainPackDraftPersistenceService.persistVersion(7L, null, 11L, null))
        .willReturn(version);

    CreateDomainPackDraftFromPipelineResult result =
        useCase.execute(
            new CreateDomainPackDraftFromPipelineCommand(3L, "refund-pack", "환불 Pack", 11L, null));

    assertThat(result.domainPackId()).isEqualTo(7L);
    assertThat(result.createdPack()).isFalse();
  }
}
