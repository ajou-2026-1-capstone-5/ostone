package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import java.util.Collections;
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

  @Test
  @DisplayName("command 생성 시 null collection은 빈 불변 리스트로 정규화한다")
  void command_nullCollections_normalizedToImmutableEmptyLists() {
    AddWorkflowDraftToVersionCommand command =
        new AddWorkflowDraftToVersionCommand(101L, null, null, null, null, null, null);

    assertThat(command.slots()).isEmpty();
    assertThat(command.policies()).isEmpty();
    assertThat(command.risks()).isEmpty();
    assertThat(command.workflows()).isEmpty();
    assertThat(command.intentSlotBindings()).isEmpty();
    assertThat(command.intentWorkflowBindings()).isEmpty();
    assertThatThrownBy(() -> command.slots().add(null))
        .isInstanceOf(UnsupportedOperationException.class);
  }

  @Test
  @DisplayName("command 생성 시 collection 내부 null element는 거부한다")
  void command_nullCollectionElement_throws() {
    assertThatThrownBy(
            () ->
                new AddWorkflowDraftToVersionCommand(
                    101L,
                    Collections.singletonList(null),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of()))
        .isInstanceOf(NullPointerException.class);
  }
}
