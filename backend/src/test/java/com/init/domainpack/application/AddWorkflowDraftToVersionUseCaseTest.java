package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("AddWorkflowDraftToVersionUseCase")
class AddWorkflowDraftToVersionUseCaseTest {

  @Mock private DomainPackDraftPersistenceService domainPackDraftPersistenceService;

  @Test
  @DisplayName("workflow draft 적재를 persistence service에 위임한다")
  void execute_delegatesToPersistenceService() {
    AddWorkflowDraftToVersionUseCase useCase =
        new AddWorkflowDraftToVersionUseCase(domainPackDraftPersistenceService);
    AddWorkflowDraftToVersionCommand command =
        new AddWorkflowDraftToVersionCommand(
            101L, List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
    AddWorkflowDraftToVersionResult expected =
        new AddWorkflowDraftToVersionResult(101L, 7L, 0, 0, 0, 0, 0, 0);
    given(
            domainPackDraftPersistenceService.persistWorkflowDraft(
                101L, List.of(), List.of(), List.of(), List.of(), List.of(), List.of()))
        .willReturn(expected);

    AddWorkflowDraftToVersionResult result = useCase.execute(command);

    assertThat(result).isEqualTo(expected);
    verify(domainPackDraftPersistenceService)
        .persistWorkflowDraft(
            101L, List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
  }
}
