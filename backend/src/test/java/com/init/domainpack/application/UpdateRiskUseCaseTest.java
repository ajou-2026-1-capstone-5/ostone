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
@DisplayName("UpdateRiskUseCase")
class UpdateRiskUseCaseTest {

  @Mock private DomainPackValidator validator;
  @Mock private RiskDefinitionRepository riskRepository;
  @Mock private DomainPackVersionRepository versionRepository;

  private UpdateRiskUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase = new UpdateRiskUseCase(validator, riskRepository, versionRepository);
  }

  @Test
  @DisplayName("정상 수정: DRAFT 버전의 위험요소 → 200 OK, 수정된 위험요소 반환")
  void should_수정성공_when_DRAFT버전위험요소() {
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));

    RiskDefinition risk = risk(55L, 10L);
    given(riskRepository.findById(55L)).willReturn(Optional.of(risk));
    given(riskRepository.save(any())).willReturn(risk);

    UpdateRiskCommand command =
        new UpdateRiskCommand(
            1L, 7L, 10L, 55L, 5L, "결제 분쟁 위험", "설명", "high", "{}", "{}", "[]", "{}");

    RiskDefinitionResponse result = useCase.execute(command);

    assertThat(result.name()).isEqualTo("결제 분쟁 위험");
    assertThat(result.riskLevel()).isEqualTo("HIGH");
    verify(riskRepository).save(risk);
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
                    new UpdateRiskCommand(
                        1L, 7L, 10L, 55L, 5L, "위험요소", null, null, null, null, null, null)))
        .isInstanceOf(DomainPackWorkspaceNotFoundException.class);

    verify(versionRepository, never()).findById(any());
    verify(riskRepository, never()).save(any());
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
                    new UpdateRiskCommand(
                        1L, 7L, 10L, 55L, 5L, "위험요소", null, null, null, null, null, null)))
        .isInstanceOf(DomainPackUnauthorizedWorkspaceAccessException.class);

    verify(versionRepository, never()).findById(any());
    verify(riskRepository, never()).save(any());
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
                    new UpdateRiskCommand(
                        1L, 7L, 10L, 55L, 5L, "위험요소", null, null, null, null, null, null)))
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
                    new UpdateRiskCommand(
                        1L, 7L, 10L, 55L, 5L, "위험요소", null, null, null, null, null, null)))
        .isInstanceOf(NotFoundException.class);

    verify(riskRepository, never()).save(any());
  }

  @Test
  @DisplayName("packId 불일치 → NotFoundException")
  void should_버전없음예외_when_packId불일치() {
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 99L)));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateRiskCommand(
                        1L, 7L, 10L, 55L, 5L, "위험요소", null, null, null, null, null, null)))
        .isInstanceOf(NotFoundException.class);

    verify(riskRepository, never()).save(any());
  }

  @Test
  @DisplayName("PUBLISHED 버전 → BadRequestException(RISK_NOT_EDITABLE)")
  void should_RISK_NOT_EDITABLE예외_when_PUBLISHED버전() {
    given(versionRepository.findById(10L)).willReturn(Optional.of(publishedVersion(10L, 7L)));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateRiskCommand(
                        1L, 7L, 10L, 55L, 5L, "위험요소", null, null, null, null, null, null)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("DRAFT");

    verify(riskRepository, never()).save(any());
  }

  @Test
  @DisplayName("위험요소 미존재 → NotFoundException")
  void should_위험요소없음예외_when_위험요소미존재() {
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));
    given(riskRepository.findById(55L)).willReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateRiskCommand(
                        1L, 7L, 10L, 55L, 5L, "위험요소", null, null, null, null, null, null)))
        .isInstanceOf(NotFoundException.class);

    verify(riskRepository, never()).save(any());
  }

  @Test
  @DisplayName("위험요소의 versionId 불일치 → NotFoundException")
  void should_위험요소없음예외_when_versionId불일치() {
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));

    RiskDefinition risk = risk(55L, 999L);
    given(riskRepository.findById(55L)).willReturn(Optional.of(risk));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateRiskCommand(
                        1L, 7L, 10L, 55L, 5L, "위험요소", null, null, null, null, null, null)))
        .isInstanceOf(NotFoundException.class);

    verify(riskRepository, never()).save(any());
  }

  @Test
  @DisplayName("잘못된 riskLevel 입력 → BadRequestException(VALIDATION_ERROR)")
  void should_VALIDATION_ERROR예외_when_잘못된riskLevel() {
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));

    RiskDefinition risk = risk(55L, 10L);
    given(riskRepository.findById(55L)).willReturn(Optional.of(risk));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateRiskCommand(
                        1L, 7L, 10L, 55L, 5L, "위험요소", null, "unknown", null, null, null, null)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("Invalid riskLevel");

    verify(riskRepository, never()).save(any());
  }

  @Test
  @DisplayName("name이 null이면 BadRequestException(VALIDATION_ERROR)")
  void should_VALIDATION_ERROR예외_when_nameNull() {
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));

    RiskDefinition risk = risk(55L, 10L);
    given(riskRepository.findById(55L)).willReturn(Optional.of(risk));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateRiskCommand(
                        1L, 7L, 10L, 55L, 5L, null, null, null, null, null, null, null)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("name은 필수 항목입니다.");

    verify(riskRepository, never()).save(any());
  }

  @Test
  @DisplayName("name이 빈 문자열이면 BadRequestException(VALIDATION_ERROR)")
  void should_VALIDATION_ERROR예외_when_nameBlank() {
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));

    RiskDefinition risk = risk(55L, 10L);
    given(riskRepository.findById(55L)).willReturn(Optional.of(risk));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateRiskCommand(
                        1L, 7L, 10L, 55L, 5L, "", null, null, null, null, null, null)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("name은 비워둘 수 없습니다.");

    verify(riskRepository, never()).save(any());
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
