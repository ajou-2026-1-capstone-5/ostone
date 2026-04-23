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
import com.init.domainpack.domain.model.RiskDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
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
@DisplayName("UpdateRiskStatusUseCase")
class UpdateRiskStatusUseCaseTest {

  @Mock private DomainPackValidator validator;
  @Mock private RiskDefinitionRepository riskRepository;
  @Mock private DomainPackVersionRepository versionRepository;

  private UpdateRiskStatusUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase = new UpdateRiskStatusUseCase(validator, riskRepository, versionRepository);
  }

  @Test
  @DisplayName("정상 전환: ACTIVE → INACTIVE")
  void should_INACTIVE전환성공_when_DRAFT버전위험요소() {
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));

    RiskDefinition risk = risk(55L, 10L);
    given(riskRepository.findByIdOrThrow(55L)).willReturn(risk);
    given(riskRepository.save(any())).willReturn(risk);

    UpdateRiskStatusCommand command =
        new UpdateRiskStatusCommand(1L, 7L, 10L, 55L, 5L, RiskDefinition.STATUS_INACTIVE);

    RiskDefinitionResponse result = useCase.execute(command);

    assertThat(result.status()).isEqualTo(RiskDefinition.STATUS_INACTIVE);
    verify(riskRepository).save(risk);
  }

  @Test
  @DisplayName("정상 전환: INACTIVE → ACTIVE")
  void should_ACTIVE전환성공_when_INACTIVE위험요소() {
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));

    RiskDefinition risk = risk(55L, 10L);
    ReflectionTestUtils.setField(risk, "status", RiskDefinition.STATUS_INACTIVE);
    given(riskRepository.findByIdOrThrow(55L)).willReturn(risk);
    given(riskRepository.save(any())).willReturn(risk);

    UpdateRiskStatusCommand command =
        new UpdateRiskStatusCommand(1L, 7L, 10L, 55L, 5L, RiskDefinition.STATUS_ACTIVE);

    RiskDefinitionResponse result = useCase.execute(command);

    assertThat(result.status()).isEqualTo(RiskDefinition.STATUS_ACTIVE);
    verify(riskRepository).save(risk);
  }

  @Test
  @DisplayName("허용되지 않는 status 값 → BadRequestException(VALIDATION_ERROR)")
  void should_VALIDATION_ERROR예외_when_잘못된status() {
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));

    RiskDefinition risk = risk(55L, 10L);
    given(riskRepository.findByIdOrThrow(55L)).willReturn(risk);

    assertThatThrownBy(
            () -> useCase.execute(new UpdateRiskStatusCommand(1L, 7L, 10L, 55L, 5L, "DEPRECATED")))
        .isInstanceOf(BadRequestException.class);
  }

  @Test
  @DisplayName("PUBLISHED 버전 → BadRequestException(RISK_NOT_EDITABLE)")
  void should_RISK_NOT_EDITABLE예외_when_PUBLISHED버전() {
    given(versionRepository.findById(10L)).willReturn(Optional.of(publishedVersion(10L, 7L)));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateRiskStatusCommand(
                        1L, 7L, 10L, 55L, 5L, RiskDefinition.STATUS_INACTIVE)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("DRAFT");

    verify(riskRepository, never()).save(any());
  }

  @Test
  @DisplayName("위험요소의 versionId 불일치 → NotFoundException")
  void should_위험요소없음예외_when_versionId불일치() {
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));

    RiskDefinition risk = risk(55L, 999L);
    given(riskRepository.findByIdOrThrow(55L)).willReturn(risk);

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateRiskStatusCommand(
                        1L, 7L, 10L, 55L, 5L, RiskDefinition.STATUS_INACTIVE)))
        .isInstanceOf(NotFoundException.class);

    verify(riskRepository, never()).save(any());
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
                    new UpdateRiskStatusCommand(
                        1L, 7L, 10L, 55L, 5L, RiskDefinition.STATUS_INACTIVE)))
        .isInstanceOf(DomainPackWorkspaceNotFoundException.class);

    verify(versionRepository, never()).findById(any());
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
                    new UpdateRiskStatusCommand(
                        1L, 7L, 10L, 55L, 5L, RiskDefinition.STATUS_INACTIVE)))
        .isInstanceOf(DomainPackUnauthorizedWorkspaceAccessException.class);

    verify(versionRepository, never()).findById(any());
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
                    new UpdateRiskStatusCommand(
                        1L, 7L, 10L, 55L, 5L, RiskDefinition.STATUS_INACTIVE)))
        .isInstanceOf(DomainPackNotFoundException.class);

    verify(versionRepository, never()).findById(any());
    verify(riskRepository, never()).save(any());
  }

  @Test
  @DisplayName("버전 미존재 → NotFoundException")
  void should_버전없음예외_when_버전미존재() {
    given(versionRepository.findById(10L)).willReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateRiskStatusCommand(
                        1L, 7L, 10L, 55L, 5L, RiskDefinition.STATUS_INACTIVE)))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  @DisplayName("packId 불일치 → NotFoundException")
  void should_버전없음예외_when_packId불일치() {
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 99L)));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateRiskStatusCommand(
                        1L, 7L, 10L, 55L, 5L, RiskDefinition.STATUS_INACTIVE)))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  @DisplayName("위험요소 미존재 → NotFoundException")
  void should_위험요소없음예외_when_위험요소미존재() {
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));
    given(riskRepository.findByIdOrThrow(55L))
        .willThrow(new NotFoundException("NOT_FOUND", "위험요소를 찾을 수 없습니다: 55"));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateRiskStatusCommand(
                        1L, 7L, 10L, 55L, 5L, RiskDefinition.STATUS_INACTIVE)))
        .isInstanceOf(NotFoundException.class);
  }

  private DomainPackVersion draftVersion(Long id, Long domainPackId) {
    return DomainPackVersion.ofForTest(id, domainPackId, DomainPackVersion.STATUS_DRAFT);
  }

  private DomainPackVersion publishedVersion(Long id, Long domainPackId) {
    return DomainPackVersion.ofForTest(id, domainPackId, DomainPackVersion.STATUS_PUBLISHED);
  }

  private RiskDefinition risk(Long id, Long versionId) {
    RiskDefinition risk =
        RiskDefinition.create(
            versionId, "payment_dispute_risk", "결제 분쟁 위험", "설명", "HIGH", "{}", "{}", "[]", "{}");
    ReflectionTestUtils.setField(risk, "id", id);
    return risk;
  }
}
