package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

import com.init.domainpack.application.exception.DomainPackNotFoundException;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.domainpack.application.exception.SlotDefinitionNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.domainpack.domain.repository.WorkspaceExistencePort;
import com.init.domainpack.domain.repository.WorkspaceMembershipPort;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("GetSlotDefinitionUseCase")
class GetSlotDefinitionUseCaseTest {

  @Mock private WorkspaceExistencePort workspaceExistencePort;
  @Mock private WorkspaceMembershipPort workspaceMembershipPort;
  @Mock private DomainPackRepository domainPackRepository;
  @Mock private DomainPackVersionRepository domainPackVersionRepository;
  @Mock private SlotDefinitionRepository slotDefinitionRepository;

  private GetSlotDefinitionUseCase useCase;

  private static final Long WORKSPACE_ID = 1L;
  private static final Long PACK_ID = 7L;
  private static final Long VERSION_ID = 101L;
  private static final Long SLOT_ID = 3001L;
  private static final Long USER_ID = 10L;

  @BeforeEach
  void setUp() {
    DomainPackValidator validator =
        new DomainPackValidator(
            workspaceExistencePort,
            workspaceMembershipPort,
            domainPackRepository,
            domainPackVersionRepository,
            null);
    useCase = new GetSlotDefinitionUseCase(validator, slotDefinitionRepository);
  }

  @Test
  @DisplayName("유효한 query → SlotDefinitionResponse 전체 필드 반환")
  void should_returnFullResponse_when_validQuery() {
    // given
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(true);
    given(domainPackVersionRepository.findById(VERSION_ID))
        .willReturn(Optional.of(createVersion(VERSION_ID, PACK_ID)));
    given(slotDefinitionRepository.findByIdAndDomainPackVersionId(SLOT_ID, VERSION_ID))
        .willReturn(Optional.of(createSlot(SLOT_ID, "customer_name", "고객명")));

    // when
    SlotDefinitionResponse result =
        useCase.execute(
            new GetSlotDefinitionQuery(WORKSPACE_ID, PACK_ID, VERSION_ID, SLOT_ID, USER_ID));

    // then
    assertThat(result.id()).isEqualTo(SLOT_ID);
    assertThat(result.slotCode()).isEqualTo("customer_name");
    assertThat(result.validationRuleJson()).isEqualTo("{}");
    assertThat(result.metaJson()).isEqualTo("{}");
  }

  @Test
  @DisplayName("존재하지 않는 slotId → SlotDefinitionNotFoundException")
  void should_throwNotFoundException_when_slotNotFound() {
    // given
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(true);
    given(domainPackVersionRepository.findById(VERSION_ID))
        .willReturn(Optional.of(createVersion(VERSION_ID, PACK_ID)));
    given(slotDefinitionRepository.findByIdAndDomainPackVersionId(SLOT_ID, VERSION_ID))
        .willReturn(Optional.empty());

    // when & then
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new GetSlotDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, SLOT_ID, USER_ID)))
        .isInstanceOf(SlotDefinitionNotFoundException.class);
  }

  @Test
  @DisplayName("다른 version 소속 slotId → SlotDefinitionNotFoundException")
  void should_throwNotFoundException_when_slotBelongsToOtherVersion() {
    // given — slotId exists but belongs to a different versionId, so composite lookup returns empty
    Long otherVersionId = VERSION_ID + 1L;
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(true);
    given(domainPackVersionRepository.findById(otherVersionId))
        .willReturn(Optional.of(createVersion(otherVersionId, PACK_ID)));
    given(slotDefinitionRepository.findByIdAndDomainPackVersionId(SLOT_ID, otherVersionId))
        .willReturn(Optional.empty());

    // when & then
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new GetSlotDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, otherVersionId, SLOT_ID, USER_ID)))
        .isInstanceOf(SlotDefinitionNotFoundException.class);
  }

  @Test
  @DisplayName("workspace 없음 → DomainPackWorkspaceNotFoundException")
  void should_throwWorkspaceNotFoundException_when_workspaceNotFound() {
    // given
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(false);

    // when & then
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new GetSlotDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, SLOT_ID, USER_ID)))
        .isInstanceOf(DomainPackWorkspaceNotFoundException.class);
  }

  @Test
  @DisplayName("접근 권한 없음 → DomainPackUnauthorizedWorkspaceAccessException")
  void should_throwUnauthorizedException_when_unauthorized() {
    // given
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(false);

    // when & then
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new GetSlotDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, SLOT_ID, USER_ID)))
        .isInstanceOf(DomainPackUnauthorizedWorkspaceAccessException.class);
  }

  @Test
  @DisplayName("domain pack 소속 불일치 → DomainPackNotFoundException")
  void should_throwDomainPackNotFoundException_when_packNotInWorkspace() {
    // given
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(false);

    // when & then
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new GetSlotDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, SLOT_ID, USER_ID)))
        .isInstanceOf(DomainPackNotFoundException.class);
  }

  @Test
  @DisplayName("version 소속 불일치 → DomainPackVersionNotFoundException")
  void should_throwVersionNotFoundException_when_versionNotInPack() {
    // given
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(true);
    given(domainPackVersionRepository.findById(VERSION_ID))
        .willReturn(Optional.of(createVersion(VERSION_ID, 999L)));

    // when & then
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new GetSlotDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, SLOT_ID, USER_ID)))
        .isInstanceOf(DomainPackVersionNotFoundException.class);
  }

  private DomainPackVersion createVersion(Long id, Long packId) {
    return DomainPackVersion.ofForTest(id, packId, DomainPackVersion.STATUS_DRAFT);
  }

  private SlotDefinition createSlot(Long id, String slotCode, String name) {
    SlotDefinition slot =
        SlotDefinition.create(VERSION_ID, slotCode, name, null, "STRING", false, "{}", null, "{}");
    ReflectionTestUtils.setField(slot, "id", id);
    ReflectionTestUtils.setField(slot, "createdAt", OffsetDateTime.parse("2026-04-10T10:00:00Z"));
    ReflectionTestUtils.setField(slot, "updatedAt", OffsetDateTime.parse("2026-04-10T10:00:00Z"));
    return slot;
  }
}
