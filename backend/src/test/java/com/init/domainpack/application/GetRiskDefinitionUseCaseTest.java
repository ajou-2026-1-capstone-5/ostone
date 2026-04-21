package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

import com.init.domainpack.application.exception.DomainPackNotFoundException;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.domainpack.application.exception.RiskDefinitionNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.RiskDefinition;
import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
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
@DisplayName("GetRiskDefinitionUseCase")
class GetRiskDefinitionUseCaseTest {

  @Mock private WorkspaceExistencePort workspaceExistencePort;
  @Mock private WorkspaceMembershipPort workspaceMembershipPort;
  @Mock private DomainPackRepository domainPackRepository;
  @Mock private DomainPackVersionRepository domainPackVersionRepository;
  @Mock private RiskDefinitionRepository riskDefinitionRepository;

  private GetRiskDefinitionUseCase useCase;

  private static final Long WORKSPACE_ID = 1L;
  private static final Long PACK_ID = 7L;
  private static final Long VERSION_ID = 101L;
  private static final Long RISK_ID = 5001L;
  private static final Long USER_ID = 10L;

  @BeforeEach
  void setUp() {
    DomainPackValidator validator =
        new DomainPackValidator(
            workspaceExistencePort,
            workspaceMembershipPort,
            domainPackRepository,
            domainPackVersionRepository);
    useCase = new GetRiskDefinitionUseCase(validator, riskDefinitionRepository);
  }

  @Test
  @DisplayName("유효한 query → RiskDefinitionResponse 전체 필드 반환")
  void should_returnFullResponse_when_validQuery() {
    // given
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(true);
    given(domainPackVersionRepository.findById(VERSION_ID))
        .willReturn(Optional.of(createVersion(VERSION_ID, PACK_ID)));
    given(riskDefinitionRepository.findByIdAndDomainPackVersionId(RISK_ID, VERSION_ID))
        .willReturn(Optional.of(createRisk(RISK_ID, "RISK_FRAUD", "사기 거래 위험")));

    // when
    RiskDefinitionResponse result =
        useCase.execute(
            new GetRiskDefinitionQuery(WORKSPACE_ID, PACK_ID, VERSION_ID, RISK_ID, USER_ID));

    // then
    assertThat(result.id()).isEqualTo(RISK_ID);
    assertThat(result.domainPackVersionId()).isEqualTo(VERSION_ID);
    assertThat(result.riskCode()).isEqualTo("RISK_FRAUD");
    assertThat(result.name()).isEqualTo("사기 거래 위험");
    assertThat(result.description()).isEqualTo("비정상적인 결제 패턴 감지 시 차단");
    assertThat(result.riskLevel()).isEqualTo("HIGH");
    assertThat(result.triggerConditionJson()).isEqualTo("{}");
    assertThat(result.handlingActionJson()).isEqualTo("{}");
    assertThat(result.evidenceJson()).isEqualTo("[]");
    assertThat(result.metaJson()).isEqualTo("{}");
    assertThat(result.status()).isEqualTo("ACTIVE");
    assertThat(result.createdAt()).isEqualTo(OffsetDateTime.parse("2026-04-10T10:00:00Z"));
    assertThat(result.updatedAt()).isEqualTo(OffsetDateTime.parse("2026-04-10T10:00:00Z"));
  }

  @Test
  @DisplayName("존재하지 않는 riskId → RiskDefinitionNotFoundException")
  void should_throwNotFoundException_when_riskNotFound() {
    // given
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(true);
    given(domainPackVersionRepository.findById(VERSION_ID))
        .willReturn(Optional.of(createVersion(VERSION_ID, PACK_ID)));
    given(riskDefinitionRepository.findByIdAndDomainPackVersionId(RISK_ID, VERSION_ID))
        .willReturn(Optional.empty());

    // when & then
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new GetRiskDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, RISK_ID, USER_ID)))
        .isInstanceOf(RiskDefinitionNotFoundException.class);
  }

  @Test
  @DisplayName("다른 version 소속 riskId → RiskDefinitionNotFoundException")
  void should_throwNotFoundException_when_riskBelongsToOtherVersion() {
    // given — riskId exists but belongs to a different versionId, so composite lookup returns empty
    Long otherVersionId = VERSION_ID + 1L;
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(true);
    given(domainPackVersionRepository.findById(otherVersionId))
        .willReturn(Optional.of(createVersion(otherVersionId, PACK_ID)));
    given(riskDefinitionRepository.findByIdAndDomainPackVersionId(RISK_ID, otherVersionId))
        .willReturn(Optional.empty());

    // when & then
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new GetRiskDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, otherVersionId, RISK_ID, USER_ID)))
        .isInstanceOf(RiskDefinitionNotFoundException.class);
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
                    new GetRiskDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, RISK_ID, USER_ID)))
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
                    new GetRiskDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, RISK_ID, USER_ID)))
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
                    new GetRiskDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, RISK_ID, USER_ID)))
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
                    new GetRiskDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, RISK_ID, USER_ID)))
        .isInstanceOf(DomainPackVersionNotFoundException.class);
  }

  private DomainPackVersion createVersion(Long id, Long packId) {
    return DomainPackVersion.ofForTest(id, packId, DomainPackVersion.STATUS_DRAFT);
  }

  private RiskDefinition createRisk(Long id, String riskCode, String name) {
    RiskDefinition risk =
        RiskDefinition.create(
            VERSION_ID, riskCode, name, "비정상적인 결제 패턴 감지 시 차단", "HIGH", "{}", "{}", "[]", "{}");
    ReflectionTestUtils.setField(risk, "id", id);
    ReflectionTestUtils.setField(risk, "createdAt", OffsetDateTime.parse("2026-04-10T10:00:00Z"));
    ReflectionTestUtils.setField(risk, "updatedAt", OffsetDateTime.parse("2026-04-10T10:00:00Z"));
    return risk;
  }
}
