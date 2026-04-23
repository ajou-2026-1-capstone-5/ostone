package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.domainpack.application.exception.WorkflowActionNodePolicyRefNotFoundException;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
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

  @Mock private PolicyDefinitionRepository policyDefinitionRepository;

  private DomainPackValidator validator;

  @BeforeEach
  void setUp() {
    validator = new DomainPackValidator(null, null, null, null, policyDefinitionRepository);
  }

  @Test
  @DisplayName("미존재 policyCode를 만나면 즉시 예외를 던지고 이후 코드는 조회하지 않는다")
  void should_fail_fast_when_policyCodeMissing() {
    // given: 순서 보장을 위해 LinkedHashSet 사용 [p-1(valid) → p-2(missing) → p-3]
    given(policyDefinitionRepository.existsByDomainPackVersionIdAndPolicyCode(VERSION_ID, "p-1"))
        .willReturn(true);
    given(policyDefinitionRepository.existsByDomainPackVersionIdAndPolicyCode(VERSION_ID, "p-2"))
        .willReturn(false);
    Set<String> codes = new LinkedHashSet<>(List.of("p-1", "p-2", "p-3"));

    // when & then
    assertThatThrownBy(() -> validator.validatePolicyCodes(VERSION_ID, codes))
        .isInstanceOf(WorkflowActionNodePolicyRefNotFoundException.class)
        .satisfies(
            e -> {
              WorkflowActionNodePolicyRefNotFoundException typed =
                  (WorkflowActionNodePolicyRefNotFoundException) e;
              assertThat(typed.getCode()).isEqualTo("WORKFLOW_ACTION_NODE_POLICY_REF_NOT_FOUND");
              assertThat(typed.getMessage()).contains("p-2");
            });
    // p-2에서 즉시 예외 → p-3는 조회되면 안 됨
    verify(policyDefinitionRepository, never())
        .existsByDomainPackVersionIdAndPolicyCode(VERSION_ID, "p-3");
  }
}
