package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

import com.init.domainpack.application.exception.DomainPackNotFoundException;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.domainpack.application.exception.PolicyDefinitionNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
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
@DisplayName("GetPolicyDefinitionUseCase")
class GetPolicyDefinitionUseCaseTest {

  @Mock private WorkspaceExistencePort workspaceExistencePort;
  @Mock private WorkspaceMembershipPort workspaceMembershipPort;
  @Mock private DomainPackRepository domainPackRepository;
  @Mock private DomainPackVersionRepository domainPackVersionRepository;
  @Mock private PolicyDefinitionRepository policyDefinitionRepository;

  private GetPolicyDefinitionUseCase useCase;

  private static final Long WORKSPACE_ID = 1L;
  private static final Long PACK_ID = 7L;
  private static final Long VERSION_ID = 101L;
  private static final Long POLICY_ID = 3001L;
  private static final Long USER_ID = 10L;

  @BeforeEach
  void setUp() {
    DomainPackValidator validator =
        new DomainPackValidator(
            workspaceExistencePort,
            workspaceMembershipPort,
            domainPackRepository,
            domainPackVersionRepository);
    useCase = new GetPolicyDefinitionUseCase(validator, policyDefinitionRepository);
  }

  @Test
  @DisplayName("유효한 query → PolicyDefinitionResponse 전체 필드 반환")
  void should_returnFullResponse_when_validQuery() {
    // given
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(true);
    given(domainPackVersionRepository.findById(VERSION_ID))
        .willReturn(Optional.of(createVersion(VERSION_ID, PACK_ID)));
    given(policyDefinitionRepository.findByIdAndDomainPackVersionId(POLICY_ID, VERSION_ID))
        .willReturn(Optional.of(createPolicy(POLICY_ID, "POL_RETURN", "반품 처리 정책")));

    // when
    PolicyDefinitionResponse result =
        useCase.execute(
            new GetPolicyDefinitionQuery(WORKSPACE_ID, PACK_ID, VERSION_ID, POLICY_ID, USER_ID));

    // then
    assertThat(result.id()).isEqualTo(POLICY_ID);
    assertThat(result.domainPackVersionId()).isEqualTo(VERSION_ID);
    assertThat(result.policyCode()).isEqualTo("POL_RETURN");
    assertThat(result.name()).isEqualTo("반품 처리 정책");
    assertThat(result.description()).isEqualTo("7일 이내 반품 허용");
    assertThat(result.severity()).isEqualTo("HIGH");
    assertThat(result.conditionJson()).isEqualTo("{}");
    assertThat(result.actionJson()).isEqualTo("{}");
    assertThat(result.evidenceJson()).isEqualTo("[]");
    assertThat(result.metaJson()).isEqualTo("{}");
    assertThat(result.status()).isEqualTo("ACTIVE");
    assertThat(result.createdAt()).isEqualTo(OffsetDateTime.parse("2026-04-10T10:00:00Z"));
    assertThat(result.updatedAt()).isEqualTo(OffsetDateTime.parse("2026-04-10T10:00:00Z"));
  }

  @Test
  @DisplayName("존재하지 않는 policyId → PolicyDefinitionNotFoundException")
  void should_throwNotFoundException_when_policyNotFound() {
    // given
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(true);
    given(domainPackVersionRepository.findById(VERSION_ID))
        .willReturn(Optional.of(createVersion(VERSION_ID, PACK_ID)));
    given(policyDefinitionRepository.findByIdAndDomainPackVersionId(POLICY_ID, VERSION_ID))
        .willReturn(Optional.empty());

    // when & then
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new GetPolicyDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, POLICY_ID, USER_ID)))
        .isInstanceOf(PolicyDefinitionNotFoundException.class);
  }

  @Test
  @DisplayName("다른 version 소속 policyId → PolicyDefinitionNotFoundException")
  void should_throwNotFoundException_when_policyBelongsToOtherVersion() {
    // given — policyId exists but belongs to a different versionId, so composite lookup returns
    // empty
    Long otherVersionId = VERSION_ID + 1L;
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(true);
    given(domainPackVersionRepository.findById(otherVersionId))
        .willReturn(Optional.of(createVersion(otherVersionId, PACK_ID)));
    given(policyDefinitionRepository.findByIdAndDomainPackVersionId(POLICY_ID, otherVersionId))
        .willReturn(Optional.empty());

    // when & then
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new GetPolicyDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, otherVersionId, POLICY_ID, USER_ID)))
        .isInstanceOf(PolicyDefinitionNotFoundException.class);
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
                    new GetPolicyDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, POLICY_ID, USER_ID)))
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
                    new GetPolicyDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, POLICY_ID, USER_ID)))
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
                    new GetPolicyDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, POLICY_ID, USER_ID)))
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
                    new GetPolicyDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, POLICY_ID, USER_ID)))
        .isInstanceOf(DomainPackVersionNotFoundException.class);
  }

  private DomainPackVersion createVersion(Long id, Long packId) {
    return DomainPackVersion.ofForTest(id, packId, DomainPackVersion.STATUS_DRAFT);
  }

  private PolicyDefinition createPolicy(Long id, String policyCode, String name) {
    PolicyDefinition policy =
        PolicyDefinition.create(
            VERSION_ID, policyCode, name, "7일 이내 반품 허용", "HIGH", "{}", "{}", "[]", "{}");
    ReflectionTestUtils.setField(policy, "id", id);
    ReflectionTestUtils.setField(policy, "createdAt", OffsetDateTime.parse("2026-04-10T10:00:00Z"));
    ReflectionTestUtils.setField(policy, "updatedAt", OffsetDateTime.parse("2026-04-10T10:00:00Z"));
    return policy;
  }
}
