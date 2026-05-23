package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.domainpack.domain.model.DomainPack;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.WorkspaceExistencePort;
import com.init.domainpack.domain.repository.WorkspaceMembershipPort;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("GetDomainPackListUseCase")
class GetDomainPackListUseCaseTest {

  @Mock private WorkspaceExistencePort workspaceExistencePort;
  @Mock private WorkspaceMembershipPort workspaceMembershipPort;
  @Mock private DomainPackRepository domainPackRepository;
  @Mock private DomainPackVersionRepository domainPackVersionRepository;

  private GetDomainPackListUseCase useCase;

  private static final Long WORKSPACE_ID = 1L;
  private static final Long USER_ID = 99L;
  private static final OffsetDateTime CREATED_AT =
      OffsetDateTime.parse("2025-03-01T09:00:00+09:00");
  private static final OffsetDateTime UPDATED_AT =
      OffsetDateTime.parse("2025-03-02T09:00:00+09:00");
  private static final OffsetDateTime PUBLISHED_AT =
      OffsetDateTime.parse("2025-03-03T09:00:00+09:00");

  @BeforeEach
  void setUp() {
    DomainPackValidator validator =
        new DomainPackValidator(
            workspaceExistencePort,
            workspaceMembershipPort,
            domainPackRepository,
            domainPackVersionRepository,
            null);
    useCase =
        new GetDomainPackListUseCase(validator, domainPackRepository, domainPackVersionRepository);
  }

  @Test
  @DisplayName("유효한 workspace → DomainPackSummaryResult 목록 반환")
  void should_반환PackSummaryList_when_유효한요청() {
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.findByWorkspaceId(WORKSPACE_ID))
        .willReturn(List.of(new StubDomainPack(10L, WORKSPACE_ID, "CS Support Pack", "고객 지원용")));
    given(domainPackVersionRepository.findCurrentPublishedByWorkspaceId(WORKSPACE_ID))
        .willReturn(Optional.of(new StubDomainPackVersion(101L, 10L, 3, PUBLISHED_AT)));

    List<DomainPackSummaryResult> result =
        useCase.execute(new GetDomainPackListQuery(WORKSPACE_ID, USER_ID));

    assertThat(result).hasSize(1);
    assertThat(result.get(0).packId()).isEqualTo(10L);
    assertThat(result.get(0).workspaceId()).isEqualTo(WORKSPACE_ID);
    assertThat(result.get(0).name()).isEqualTo("CS Support Pack");
    assertThat(result.get(0).description()).isEqualTo("고객 지원용");
    assertThat(result.get(0).status()).isEqualTo(DomainPack.STATUS_ACTIVE);
    assertThat(result.get(0).currentVersionId()).isEqualTo(101L);
    assertThat(result.get(0).currentVersionNo()).isEqualTo(3);
    assertThat(result.get(0).currentVersionPublishedAt()).isEqualTo(PUBLISHED_AT);
    assertThat(result.get(0).createdAt()).isEqualTo(CREATED_AT);
    assertThat(result.get(0).updatedAt()).isEqualTo(UPDATED_AT);
    verify(domainPackRepository).findByWorkspaceId(WORKSPACE_ID);
    verify(domainPackVersionRepository).findCurrentPublishedByWorkspaceId(WORKSPACE_ID);
  }

  @Test
  @DisplayName("published version 없는 pack → current version 필드는 null")
  void should_returnNullCurrentVersion_when_noPublishedVersion() {
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.findByWorkspaceId(WORKSPACE_ID))
        .willReturn(List.of(new StubDomainPack(11L, WORKSPACE_ID, "Draft Pack", null)));
    given(domainPackVersionRepository.findCurrentPublishedByWorkspaceId(WORKSPACE_ID))
        .willReturn(Optional.empty());

    List<DomainPackSummaryResult> result =
        useCase.execute(new GetDomainPackListQuery(WORKSPACE_ID, USER_ID));

    assertThat(result).hasSize(1);
    assertThat(result.get(0).currentVersionId()).isNull();
    assertThat(result.get(0).currentVersionNo()).isNull();
    assertThat(result.get(0).currentVersionPublishedAt()).isNull();
  }

  @Test
  @DisplayName("workspace 기준 운영 도메인팩은 하나만 current version을 가진다")
  void should_markOnlyOneOperatingPack_when_workspaceHasCurrentVersion() {
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.findByWorkspaceId(WORKSPACE_ID))
        .willReturn(
            List.of(
                new StubDomainPack(10L, WORKSPACE_ID, "Operating Pack", null),
                new StubDomainPack(11L, WORKSPACE_ID, "Previous Pack", null)));
    given(domainPackVersionRepository.findCurrentPublishedByWorkspaceId(WORKSPACE_ID))
        .willReturn(Optional.of(new StubDomainPackVersion(101L, 10L, 3, PUBLISHED_AT)));

    List<DomainPackSummaryResult> result =
        useCase.execute(new GetDomainPackListQuery(WORKSPACE_ID, USER_ID));

    assertThat(result).hasSize(2);
    assertThat(result.stream().filter(summary -> summary.currentVersionId() != null)).hasSize(1);
    assertThat(result.get(0).packId()).isEqualTo(10L);
    assertThat(result.get(0).currentVersionId()).isEqualTo(101L);
    assertThat(result.get(1).packId()).isEqualTo(11L);
    assertThat(result.get(1).currentVersionId()).isNull();
  }

  @Test
  @DisplayName("pack 없는 workspace → 빈 목록 반환")
  void should_빈목록반환_when_pack없음() {
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.findByWorkspaceId(WORKSPACE_ID)).willReturn(List.of());

    List<DomainPackSummaryResult> result =
        useCase.execute(new GetDomainPackListQuery(WORKSPACE_ID, USER_ID));

    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("workspace 미존재 → DomainPackWorkspaceNotFoundException")
  void should_throw_when_workspaceNotFound() {
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(false);

    assertThatThrownBy(() -> useCase.execute(new GetDomainPackListQuery(WORKSPACE_ID, USER_ID)))
        .isInstanceOf(DomainPackWorkspaceNotFoundException.class);

    verifyNoInteractions(domainPackRepository);
  }

  @Test
  @DisplayName("접근 권한 없음 → DomainPackUnauthorizedWorkspaceAccessException")
  void should_throw_when_접근권한없음() {
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(false);

    assertThatThrownBy(() -> useCase.execute(new GetDomainPackListQuery(WORKSPACE_ID, USER_ID)))
        .isInstanceOf(DomainPackUnauthorizedWorkspaceAccessException.class);

    verifyNoInteractions(domainPackRepository);
  }

  private static class StubDomainPack extends DomainPack {

    private final Long id;
    private final Long workspaceId;
    private final String name;
    private final String description;

    StubDomainPack(Long id, Long workspaceId, String name, String description) {
      this.id = id;
      this.workspaceId = workspaceId;
      this.name = name;
      this.description = description;
    }

    @Override
    public Long getId() {
      return id;
    }

    @Override
    public Long getWorkspaceId() {
      return workspaceId;
    }

    @Override
    public String getName() {
      return name;
    }

    @Override
    public String getDescription() {
      return description;
    }

    @Override
    public OffsetDateTime getCreatedAt() {
      return CREATED_AT;
    }

    @Override
    public OffsetDateTime getUpdatedAt() {
      return UPDATED_AT;
    }

    @Override
    public String getStatus() {
      return STATUS_ACTIVE;
    }
  }

  private static class StubDomainPackVersion extends DomainPackVersion {

    private final Long id;
    private final Long domainPackId;
    private final Integer versionNo;
    private final OffsetDateTime publishedAt;

    StubDomainPackVersion(
        Long id, Long domainPackId, Integer versionNo, OffsetDateTime publishedAt) {
      this.id = id;
      this.domainPackId = domainPackId;
      this.versionNo = versionNo;
      this.publishedAt = publishedAt;
    }

    @Override
    public Long getId() {
      return id;
    }

    @Override
    public Long getDomainPackId() {
      return domainPackId;
    }

    @Override
    public Integer getVersionNo() {
      return versionNo;
    }

    @Override
    public OffsetDateTime getPublishedAt() {
      return publishedAt;
    }
  }
}
