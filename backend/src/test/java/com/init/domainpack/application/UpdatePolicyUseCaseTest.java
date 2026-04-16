package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.domainpack.application.exception.DomainPackNotFoundException;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
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
@DisplayName("UpdatePolicyUseCase")
class UpdatePolicyUseCaseTest {

  @Mock private DomainPackValidator validator;
  @Mock private PolicyDefinitionRepository policyRepository;
  @Mock private DomainPackVersionRepository versionRepository;

  private UpdatePolicyUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase = new UpdatePolicyUseCase(validator, policyRepository, versionRepository);
  }

  @Test
  @DisplayName("정상 수정: DRAFT 버전의 정책 → 200 OK, 수정된 정책 반환")
  void should_수정성공_when_DRAFT버전정책() {
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));

    PolicyDefinition policy = policy(55L, 10L);
    given(policyRepository.findById(55L)).willReturn(Optional.of(policy));
    given(policyRepository.save(any())).willReturn(policy);

    UpdatePolicyCommand command =
        new UpdatePolicyCommand(
            1L, 7L, 10L, 55L, 5L, "수정된 정책", "설명", "HIGH", "{}", "{}", "[]", "{}");

    PolicyDefinitionResponse result = useCase.execute(command);

    assertThat(result.name()).isEqualTo("수정된 정책");
    assertThat(result.severity()).isEqualTo("HIGH");
    verify(policyRepository).save(policy);
  }

  @Test
  @DisplayName("workspace 없음 → DomainPackWorkspaceNotFoundException")
  void should_워크스페이스없음예외_when_워크스페이스없음() {
    org.mockito.Mockito.doThrow(new DomainPackWorkspaceNotFoundException("워크스페이스를 찾을 수 없습니다. id=1"))
        .when(validator)
        .validateWorkspaceAccess(1L, 5L);

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdatePolicyCommand(
                        1L, 7L, 10L, 55L, 5L, "정책", null, null, null, null, null, null)))
        .isInstanceOf(DomainPackWorkspaceNotFoundException.class);

    verify(versionRepository, never()).findById(any());
    verify(policyRepository, never()).save(any());
  }

  @Test
  @DisplayName("workspace 비멤버 → DomainPackUnauthorizedWorkspaceAccessException")
  void should_권한없음예외_when_비멤버() {
    org.mockito.Mockito.doThrow(
            new DomainPackUnauthorizedWorkspaceAccessException("워크스페이스에 접근 권한이 없습니다."))
        .when(validator)
        .validateWorkspaceAccess(1L, 5L);

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdatePolicyCommand(
                        1L, 7L, 10L, 55L, 5L, "정책", null, null, null, null, null, null)))
        .isInstanceOf(DomainPackUnauthorizedWorkspaceAccessException.class);

    verify(versionRepository, never()).findById(any());
    verify(policyRepository, never()).save(any());
  }

  @Test
  @DisplayName("pack이 다른 workspace에 속함 → DomainPackNotFoundException")
  void should_도메인팩없음예외_when_workspace경계위반() {
    org.mockito.Mockito.doThrow(new DomainPackNotFoundException(7L))
        .when(validator)
        .validateDomainPack(7L, 1L);

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdatePolicyCommand(
                        1L, 7L, 10L, 55L, 5L, "정책", null, null, null, null, null, null)))
        .isInstanceOf(DomainPackNotFoundException.class);

    verify(versionRepository, never()).findById(any());
    verify(policyRepository, never()).save(any());
  }

  @Test
  @DisplayName("버전 미존재 → NotFoundException")
  void should_버전없음예외_when_버전미존재() {
    given(versionRepository.findById(10L)).willReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdatePolicyCommand(
                        1L, 7L, 10L, 55L, 5L, "정책", null, null, null, null, null, null)))
        .isInstanceOf(NotFoundException.class);

    verify(policyRepository, never()).save(any());
  }

  @Test
  @DisplayName("packId 불일치 → NotFoundException")
  void should_버전없음예외_when_packId불일치() {
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 99L)));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdatePolicyCommand(
                        1L, 7L, 10L, 55L, 5L, "정책", null, null, null, null, null, null)))
        .isInstanceOf(NotFoundException.class);

    verify(policyRepository, never()).save(any());
  }

  @Test
  @DisplayName("PUBLISHED 버전 → BadRequestException(POLICY_NOT_EDITABLE)")
  void should_POLICY_NOT_EDITABLE예외_when_PUBLISHED버전() {
    given(versionRepository.findById(10L)).willReturn(Optional.of(publishedVersion(10L, 7L)));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdatePolicyCommand(
                        1L, 7L, 10L, 55L, 5L, "정책", null, null, null, null, null, null)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("DRAFT");

    verify(policyRepository, never()).save(any());
  }

  @Test
  @DisplayName("정책 미존재 → NotFoundException")
  void should_정책없음예외_when_정책미존재() {
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));
    given(policyRepository.findById(55L)).willReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdatePolicyCommand(
                        1L, 7L, 10L, 55L, 5L, "정책", null, null, null, null, null, null)))
        .isInstanceOf(NotFoundException.class);

    verify(policyRepository, never()).save(any());
  }

  @Test
  @DisplayName("정책의 versionId 불일치 → NotFoundException")
  void should_정책없음예외_when_versionId불일치() {
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));

    PolicyDefinition policy = policy(55L, 999L);
    given(policyRepository.findById(55L)).willReturn(Optional.of(policy));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdatePolicyCommand(
                        1L, 7L, 10L, 55L, 5L, "정책", null, null, null, null, null, null)))
        .isInstanceOf(NotFoundException.class);

    verify(policyRepository, never()).save(any());
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
