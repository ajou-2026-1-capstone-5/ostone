package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.domainpack.application.exception.WorkflowActionNodePolicyRefNotFoundException;
import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.WorkspaceExistencePort;
import com.init.domainpack.domain.repository.WorkspaceMembershipPort;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("DomainPackValidator")
class DomainPackValidatorTest {

  private static final Long VERSION_ID = 10L;

  @Mock private WorkspaceExistencePort workspaceExistencePort;
  @Mock private WorkspaceMembershipPort workspaceMembershipPort;
  @Mock private DomainPackRepository domainPackRepository;
  @Mock private DomainPackVersionRepository domainPackVersionRepository;
  @Mock private PolicyDefinitionRepository policyDefinitionRepository;

  private DomainPackValidator validator;

  @BeforeEach
  void setUp() {
    validator =
        new DomainPackValidator(
            workspaceExistencePort,
            workspaceMembershipPort,
            domainPackRepository,
            domainPackVersionRepository,
            policyDefinitionRepository);
  }

  @Test
  @DisplayName("미존재 policyCode가 있으면 예외를 던지며 단건 exists 쿼리는 호출되지 않는다")
  void should_throw_when_policyCodeMissing() {
    // given: p-1만 존재, p-2/p-3은 미존재
    Set<String> codes = new LinkedHashSet<>(List.of("p-1", "p-2", "p-3"));
    given(policyDefinitionRepository.findExistingPolicyCodesByVersionIdAndCodes(VERSION_ID, codes))
        .willReturn(Set.of("p-1"));

    // when & then
    assertThatThrownBy(() -> validator.validatePolicyCodes(VERSION_ID, codes))
        .isInstanceOf(WorkflowActionNodePolicyRefNotFoundException.class)
        .satisfies(
            e -> {
              WorkflowActionNodePolicyRefNotFoundException typed =
                  (WorkflowActionNodePolicyRefNotFoundException) e;
              assertThat(typed.getCode()).isEqualTo("WORKFLOW_ACTION_NODE_POLICY_REF_NOT_FOUND");
              assertThat(typed.getMessage()).containsAnyOf("p-2", "p-3");
            });
    // 배치 쿼리로 대체됐으므로 단건 exists는 호출되어선 안 됨
    verify(policyDefinitionRepository).findExistingPolicyCodesByVersionIdAndCodes(any(), any());
  }

  @Test
  @DisplayName("policyCodes가 비어 있으면 DB를 호출하지 않고 즉시 반환한다")
  void should_not_call_repository_when_policyCodes_empty() {
    assertThatCode(() -> validator.validatePolicyCodes(VERSION_ID, Collections.emptySet()))
        .doesNotThrowAnyException();
    verify(policyDefinitionRepository, never())
        .findExistingPolicyCodesByVersionIdAndCodes(any(), any());
  }

  @Test
  @DisplayName("모든 policyCode가 존재하면 예외를 던지지 않고 배치 쿼리를 1회 호출한다")
  void should_not_throw_when_all_policyCodes_exist() {
    Set<String> codes = new LinkedHashSet<>(List.of("p-1", "p-2"));
    given(policyDefinitionRepository.findExistingPolicyCodesByVersionIdAndCodes(VERSION_ID, codes))
        .willReturn(Set.of("p-1", "p-2"));

    assertThatCode(() -> validator.validatePolicyCodes(VERSION_ID, codes))
        .doesNotThrowAnyException();
    verify(policyDefinitionRepository).findExistingPolicyCodesByVersionIdAndCodes(VERSION_ID, codes);
  }
}
