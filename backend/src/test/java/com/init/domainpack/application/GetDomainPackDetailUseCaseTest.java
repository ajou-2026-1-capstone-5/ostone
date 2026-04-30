package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;

import com.init.domainpack.application.exception.DomainPackNotFoundException;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.WorkspaceExistencePort;
import com.init.domainpack.domain.repository.WorkspaceMembershipPort;
import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("GetDomainPackDetailUseCase")
class GetDomainPackDetailUseCaseTest {

  @Mock private WorkspaceExistencePort workspaceExistencePort;
  @Mock private WorkspaceMembershipPort workspaceMembershipPort;
  @Mock private DomainPackRepository domainPackRepository;
  @Mock private DomainPackVersionRepository domainPackVersionRepository;

  private GetDomainPackDetailUseCase useCase;

  private static final Long WORKSPACE_ID = 1L;
  private static final Long PACK_ID = 10L;
  private static final Long USER_ID = 99L;

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
        new GetDomainPackDetailUseCase(
            validator, domainPackRepository, domainPackVersionRepository);
  }

  @Test
  @DisplayName("유효한 workspace+pack → DomainPackDetailResult 반환")
  void should_반환PackDetail_when_유효한요청() {
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(true);

    StubDomainPack pack = new StubDomainPack(PACK_ID, WORKSPACE_ID, "my-key", "My Pack", null);
    DomainPackVersion version =
        DomainPackVersion.ofForTest(2L, PACK_ID, DomainPackVersion.STATUS_DRAFT);
    given(domainPackRepository.findByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID))
        .willReturn(Optional.of(pack));
    given(domainPackVersionRepository.findAllByDomainPackIdOrderByVersionNoDesc(PACK_ID))
        .willReturn(List.of(version));

    DomainPackDetailResult result =
        useCase.execute(new GetDomainPackDetailQuery(WORKSPACE_ID, PACK_ID, USER_ID));

    assertThat(result.packId()).isEqualTo(PACK_ID);
    assertThat(result.workspaceId()).isEqualTo(WORKSPACE_ID);
    assertThat(result.code()).isEqualTo("my-key");
    assertThat(result.name()).isEqualTo("My Pack");
    assertThat(result.description()).isNull();
    assertThat(result.versions()).hasSize(1);
  }

  @Test
  @DisplayName("버전 없는 pack → versions 빈 리스트 반환")
  void should_반환EmptyVersions_when_버전없음() {
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(true);

    StubDomainPack pack = new StubDomainPack(PACK_ID, WORKSPACE_ID, "my-key", "My Pack", null);
    given(domainPackRepository.findByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID))
        .willReturn(Optional.of(pack));
    given(domainPackVersionRepository.findAllByDomainPackIdOrderByVersionNoDesc(PACK_ID))
        .willReturn(Collections.emptyList());

    DomainPackDetailResult result =
        useCase.execute(new GetDomainPackDetailQuery(WORKSPACE_ID, PACK_ID, USER_ID));

    assertThat(result.versions()).isEmpty();
  }

  @Test
  @DisplayName("pack 미존재 → DomainPackNotFoundException")
  void should_throw_when_packNotFound() {
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(999L, WORKSPACE_ID)).willReturn(false);

    assertThatThrownBy(
            () -> useCase.execute(new GetDomainPackDetailQuery(WORKSPACE_ID, 999L, USER_ID)))
        .isInstanceOf(DomainPackNotFoundException.class);

    verifyNoInteractions(domainPackVersionRepository);
  }

  @Test
  @DisplayName("workspace 미존재 → DomainPackWorkspaceNotFoundException")
  void should_throw_when_workspaceNotFound() {
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(false);

    assertThatThrownBy(
            () -> useCase.execute(new GetDomainPackDetailQuery(WORKSPACE_ID, PACK_ID, USER_ID)))
        .isInstanceOf(DomainPackWorkspaceNotFoundException.class);
  }

  @Test
  @DisplayName("접근 권한 없음 → DomainPackUnauthorizedWorkspaceAccessException")
  void should_throw_when_접근권한없음() {
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(false);

    assertThatThrownBy(
            () -> useCase.execute(new GetDomainPackDetailQuery(WORKSPACE_ID, PACK_ID, USER_ID)))
        .isInstanceOf(DomainPackUnauthorizedWorkspaceAccessException.class);
  }

  private static class StubDomainPack extends com.init.domainpack.domain.model.DomainPack {

    private final Long id;
    private final Long workspaceId;
    private final String packKey;
    private final String name;
    private final String description;

    StubDomainPack(Long id, Long workspaceId, String packKey, String name, String description) {
      this.id = id;
      this.workspaceId = workspaceId;
      this.packKey = packKey;
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
    public String getPackKey() {
      return packKey;
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
      return OffsetDateTime.parse("2025-03-01T09:00:00+09:00");
    }

    @Override
    public OffsetDateTime getUpdatedAt() {
      return OffsetDateTime.parse("2025-04-03T10:00:00+09:00");
    }
  }
}
