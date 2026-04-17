package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

import com.init.domainpack.application.exception.DomainPackNotFoundException;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.domainpack.application.exception.IntentDefinitionNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
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
@DisplayName("GetIntentDefinitionUseCase")
class GetIntentDefinitionUseCaseTest {

  @Mock private WorkspaceExistencePort workspaceExistencePort;
  @Mock private WorkspaceMembershipPort workspaceMembershipPort;
  @Mock private DomainPackRepository domainPackRepository;
  @Mock private DomainPackVersionRepository domainPackVersionRepository;
  @Mock private IntentDefinitionRepository intentDefinitionRepository;

  private GetIntentDefinitionUseCase useCase;

  private static final Long WORKSPACE_ID = 1L;
  private static final Long PACK_ID = 7L;
  private static final Long VERSION_ID = 101L;
  private static final Long INTENT_ID = 2001L;
  private static final Long USER_ID = 10L;

  @BeforeEach
  void setUp() {
    DomainPackValidator validator =
        new DomainPackValidator(
            workspaceExistencePort,
            workspaceMembershipPort,
            domainPackRepository,
            domainPackVersionRepository);
    useCase = new GetIntentDefinitionUseCase(validator, intentDefinitionRepository);
  }

  @Test
  @DisplayName("유효한 query로 intent 단건 전체 필드 반환")
  void should_returnDetail_when_validQuery() {
    // given
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(true);
    given(domainPackVersionRepository.findById(VERSION_ID))
        .willReturn(Optional.of(createVersion(VERSION_ID, PACK_ID)));
    given(intentDefinitionRepository.findByIdAndDomainPackVersionId(INTENT_ID, VERSION_ID))
        .willReturn(Optional.of(createIntent(INTENT_ID, "INTENT_001", "배송 조회 문의")));

    // when
    IntentDefinitionDetail result =
        useCase.execute(
            new GetIntentDefinitionQuery(WORKSPACE_ID, PACK_ID, VERSION_ID, INTENT_ID, USER_ID));

    // then
    assertThat(result.id()).isEqualTo(INTENT_ID);
    assertThat(result.intentCode()).isEqualTo("INTENT_001");
    assertThat(result.entryConditionJson()).isEqualTo("{}");
    assertThat(result.evidenceJson()).isEqualTo("[]");
    assertThat(result.metaJson()).isEqualTo("{}");
  }

  @Test
  @DisplayName("다른 versionId 소속 intentId → IntentDefinitionNotFoundException")
  void should_throwNotFoundException_when_intentBelongsToOtherVersion() {
    // given
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(true);
    given(domainPackVersionRepository.findById(VERSION_ID))
        .willReturn(Optional.of(createVersion(VERSION_ID, PACK_ID)));
    // intent exists but belongs to a different version → repository filters it out
    given(intentDefinitionRepository.findByIdAndDomainPackVersionId(INTENT_ID, VERSION_ID))
        .willReturn(Optional.empty());

    // when & then
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new GetIntentDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, INTENT_ID, USER_ID)))
        .isInstanceOf(IntentDefinitionNotFoundException.class);
  }

  @Test
  @DisplayName("존재하지 않는 intentId → IntentDefinitionNotFoundException")
  void should_throwNotFoundException_when_unknownIntentId() {
    // given
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(true);
    given(domainPackVersionRepository.findById(VERSION_ID))
        .willReturn(Optional.of(createVersion(VERSION_ID, PACK_ID)));
    given(intentDefinitionRepository.findByIdAndDomainPackVersionId(INTENT_ID, VERSION_ID))
        .willReturn(Optional.empty());

    // when & then
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new GetIntentDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, INTENT_ID, USER_ID)))
        .isInstanceOf(IntentDefinitionNotFoundException.class);
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
                    new GetIntentDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, INTENT_ID, USER_ID)))
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
                    new GetIntentDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, INTENT_ID, USER_ID)))
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
                    new GetIntentDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, INTENT_ID, USER_ID)))
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
                    new GetIntentDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, INTENT_ID, USER_ID)))
        .isInstanceOf(DomainPackVersionNotFoundException.class);
  }

  private DomainPackVersion createVersion(Long id, Long packId) {
    return DomainPackVersion.ofForTest(id, packId, DomainPackVersion.STATUS_DRAFT);
  }

  private IntentDefinition createIntent(Long id, String code, String name) {
    IntentDefinition intent =
        IntentDefinition.create(VERSION_ID, code, name, null, 1, "{}", "{}", "[]", "{}");
    ReflectionTestUtils.setField(intent, "id", id);
    ReflectionTestUtils.setField(intent, "createdAt", OffsetDateTime.parse("2026-04-10T10:00:00Z"));
    ReflectionTestUtils.setField(intent, "updatedAt", OffsetDateTime.parse("2026-04-10T10:00:00Z"));
    return intent;
  }
}
