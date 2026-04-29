package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.domainpack.domain.repository.WorkspaceExistencePort;
import com.init.domainpack.domain.repository.WorkspaceMembershipPort;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("GetDomainPackVersionDetailUseCase")
class GetDomainPackVersionDetailUseCaseTest {

  @Mock private WorkspaceExistencePort workspaceExistencePort;
  @Mock private WorkspaceMembershipPort workspaceMembershipPort;
  @Mock private DomainPackRepository domainPackRepository;
  @Mock private DomainPackVersionRepository domainPackVersionRepository;
  @Mock private IntentDefinitionRepository intentDefinitionRepository;
  @Mock private SlotDefinitionRepository slotDefinitionRepository;
  @Mock private PolicyDefinitionRepository policyDefinitionRepository;
  @Mock private RiskDefinitionRepository riskDefinitionRepository;
  @Mock private WorkflowDefinitionRepository workflowDefinitionRepository;

  private GetDomainPackVersionDetailUseCase useCase;

  private static final Long WORKSPACE_ID = 1L;
  private static final Long PACK_ID = 10L;
  private static final Long VERSION_ID = 100L;
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
        new GetDomainPackVersionDetailUseCase(
            validator,
            domainPackVersionRepository,
            intentDefinitionRepository,
            slotDefinitionRepository,
            policyDefinitionRepository,
            riskDefinitionRepository,
            workflowDefinitionRepository);
  }

  @Test
  @DisplayName("유효한 요청 → DomainPackVersionDetailResult 반환 (카운트 5종 포함)")
  void should_반환VersionDetail_when_유효한요청() {
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(true);

    DomainPackVersion version = DomainPackVersion.ofForTest(VERSION_ID, PACK_ID, DomainPackVersion.STATUS_DRAFT);
    given(domainPackVersionRepository.findById(VERSION_ID)).willReturn(Optional.of(version));
    given(domainPackVersionRepository.findByIdAndWorkspaceId(WORKSPACE_ID, VERSION_ID))
        .willReturn(Optional.of(version));

    given(intentDefinitionRepository.countByDomainPackVersionId(VERSION_ID)).willReturn(5L);
    given(slotDefinitionRepository.countByDomainPackVersionId(VERSION_ID)).willReturn(3L);
    given(policyDefinitionRepository.countByDomainPackVersionId(VERSION_ID)).willReturn(2L);
    given(riskDefinitionRepository.countByDomainPackVersionId(VERSION_ID)).willReturn(1L);
    given(workflowDefinitionRepository.countByDomainPackVersionId(VERSION_ID)).willReturn(4L);

    DomainPackVersionDetailResult result =
        useCase.execute(
            new GetDomainPackVersionDetailQuery(WORKSPACE_ID, PACK_ID, VERSION_ID, USER_ID));

    assertThat(result.versionId()).isEqualTo(VERSION_ID);
    assertThat(result.packId()).isEqualTo(PACK_ID);
    assertThat(result.intentCount()).isEqualTo(5L);
    assertThat(result.slotCount()).isEqualTo(3L);
    assertThat(result.policyCount()).isEqualTo(2L);
    assertThat(result.riskCount()).isEqualTo(1L);
    assertThat(result.workflowCount()).isEqualTo(4L);
  }

  @Test
  @DisplayName("version 미존재 → DomainPackVersionNotFoundException")
  void should_throw_when_versionNotFound() {
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(true);

    DomainPackVersion version = DomainPackVersion.ofForTest(VERSION_ID, PACK_ID, DomainPackVersion.STATUS_DRAFT);
    given(domainPackVersionRepository.findById(VERSION_ID)).willReturn(Optional.of(version));
    given(domainPackVersionRepository.findByIdAndWorkspaceId(WORKSPACE_ID, VERSION_ID))
        .willReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new GetDomainPackVersionDetailQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, USER_ID)))
        .isInstanceOf(DomainPackVersionNotFoundException.class);
  }
}
