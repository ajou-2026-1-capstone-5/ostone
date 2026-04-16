package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.WorkspaceExistencePort;
import com.init.domainpack.domain.repository.WorkspaceMembershipPort;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("UpdatePolicyStatusUseCase")
class UpdatePolicyStatusUseCaseTest {

  @Mock private PolicyDefinitionRepository policyRepository;
  @Mock private DomainPackVersionRepository versionRepository;
  @Mock private WorkspaceExistencePort workspaceExistencePort;
  @Mock private WorkspaceMembershipPort workspaceMembershipPort;

  private UpdatePolicyStatusUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase =
        new UpdatePolicyStatusUseCase(
            policyRepository, versionRepository, workspaceExistencePort, workspaceMembershipPort);
  }

  @Test
  @DisplayName("정상 전환: ACTIVE → INACTIVE")
  void should_INACTIVE전환성공_when_DRAFT버전정책() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));

    PolicyDefinition policy = policy(55L, 10L);
    given(policyRepository.findById(55L)).willReturn(Optional.of(policy));
    given(policyRepository.save(any())).willReturn(policy);

    UpdatePolicyStatusCommand command =
        new UpdatePolicyStatusCommand(1L, 7L, 10L, 55L, 5L, PolicyDefinition.STATUS_INACTIVE);

    PolicyDefinitionResponse result = useCase.execute(command);

    assertThat(result.status()).isEqualTo(PolicyDefinition.STATUS_INACTIVE);
  }

  @Test
  @DisplayName("정상 전환: INACTIVE → ACTIVE")
  void should_ACTIVE전환성공_when_INACTIVE정책() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));

    PolicyDefinition policy = policy(55L, 10L);
    ReflectionTestUtils.setField(policy, "status", PolicyDefinition.STATUS_INACTIVE);
    given(policyRepository.findById(55L)).willReturn(Optional.of(policy));
    given(policyRepository.save(any())).willReturn(policy);

    UpdatePolicyStatusCommand command =
        new UpdatePolicyStatusCommand(1L, 7L, 10L, 55L, 5L, PolicyDefinition.STATUS_ACTIVE);

    PolicyDefinitionResponse result = useCase.execute(command);

    assertThat(result.status()).isEqualTo(PolicyDefinition.STATUS_ACTIVE);
  }

  @Test
  @DisplayName("허용되지 않는 status 값 → BadRequestException(VALIDATION_ERROR)")
  void should_VALIDATION_ERROR예외_when_잘못된status() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));

    PolicyDefinition policy = policy(55L, 10L);
    given(policyRepository.findById(55L)).willReturn(Optional.of(policy));

    assertThatThrownBy(
            () ->
                useCase.execute(new UpdatePolicyStatusCommand(1L, 7L, 10L, 55L, 5L, "DEPRECATED")))
        .isInstanceOf(BadRequestException.class);
  }

  @Test
  @DisplayName("PUBLISHED 버전 → BadRequestException(POLICY_NOT_EDITABLE)")
  void should_POLICY_NOT_EDITABLE예외_when_PUBLISHED버전() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(versionRepository.findById(10L)).willReturn(Optional.of(publishedVersion(10L, 7L)));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdatePolicyStatusCommand(
                        1L, 7L, 10L, 55L, 5L, PolicyDefinition.STATUS_INACTIVE)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("DRAFT");
  }

  @Test
  @DisplayName("정책의 versionId 불일치 → NotFoundException")
  void should_정책없음예외_when_versionId불일치() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));

    PolicyDefinition policy = policy(55L, 999L);
    given(policyRepository.findById(55L)).willReturn(Optional.of(policy));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdatePolicyStatusCommand(
                        1L, 7L, 10L, 55L, 5L, PolicyDefinition.STATUS_INACTIVE)))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  @DisplayName("workspace 없음 → DomainPackWorkspaceNotFoundException")
  void should_워크스페이스없음예외_when_워크스페이스없음() {
    given(workspaceExistencePort.existsById(1L)).willReturn(false);

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdatePolicyStatusCommand(
                        1L, 7L, 10L, 55L, 5L, PolicyDefinition.STATUS_INACTIVE)))
        .isInstanceOf(DomainPackWorkspaceNotFoundException.class);

    verify(versionRepository, never()).findById(any());
  }

  @Test
  @DisplayName("workspace 비멤버 → DomainPackUnauthorizedWorkspaceAccessException")
  void should_권한없음예외_when_비멤버() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(false);

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdatePolicyStatusCommand(
                        1L, 7L, 10L, 55L, 5L, PolicyDefinition.STATUS_INACTIVE)))
        .isInstanceOf(DomainPackUnauthorizedWorkspaceAccessException.class);

    verify(versionRepository, never()).findById(any());
  }

  @Test
  @DisplayName("버전 미존재 → NotFoundException")
  void should_버전없음예외_when_버전미존재() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(versionRepository.findById(10L)).willReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdatePolicyStatusCommand(
                        1L, 7L, 10L, 55L, 5L, PolicyDefinition.STATUS_INACTIVE)))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  @DisplayName("packId 불일치 → NotFoundException")
  void should_버전없음예외_when_packId불일치() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 99L)));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdatePolicyStatusCommand(
                        1L, 7L, 10L, 55L, 5L, PolicyDefinition.STATUS_INACTIVE)))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  @DisplayName("정책 미존재 → NotFoundException")
  void should_정책없음예외_when_정책미존재() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));
    given(policyRepository.findById(55L)).willReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdatePolicyStatusCommand(
                        1L, 7L, 10L, 55L, 5L, PolicyDefinition.STATUS_INACTIVE)))
        .isInstanceOf(NotFoundException.class);
  }

  private DomainPackVersion draftVersion(Long id, Long domainPackId) {
    return DomainPackVersion.ofForTest(id, domainPackId, DomainPackVersion.STATUS_DRAFT);
  }

  private DomainPackVersion publishedVersion(Long id, Long domainPackId) {
    return DomainPackVersion.ofForTest(id, domainPackId, DomainPackVersion.STATUS_PUBLISHED);
  }

  private PolicyDefinition policy(Long id, Long versionId) {
    PolicyDefinition policy =
        PolicyDefinition.create(
            versionId, "refund_check", "환불 검증", "설명", "MEDIUM", "{}", "{}", "[]", "{}");
    ReflectionTestUtils.setField(policy, "id", id);
    return policy;
  }
}
