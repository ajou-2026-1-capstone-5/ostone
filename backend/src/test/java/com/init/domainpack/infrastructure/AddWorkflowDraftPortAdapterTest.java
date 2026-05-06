package com.init.domainpack.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentCaptor.forClass;
import static org.mockito.BDDMockito.given;

import com.init.domainpack.application.AddWorkflowDraftToVersionCommand;
import com.init.domainpack.application.AddWorkflowDraftToVersionResult;
import com.init.domainpack.application.AddWorkflowDraftToVersionUseCase;
import com.init.pipelinejob.application.AddWorkflowDraftPortCommand;
import com.init.pipelinejob.application.AddWorkflowDraftPortCommand.IntentSlotBindingDraft;
import com.init.pipelinejob.application.AddWorkflowDraftPortCommand.IntentWorkflowBindingDraft;
import com.init.pipelinejob.application.AddWorkflowDraftPortCommand.PolicyDraft;
import com.init.pipelinejob.application.AddWorkflowDraftPortCommand.RiskDraft;
import com.init.pipelinejob.application.AddWorkflowDraftPortCommand.SlotDraft;
import com.init.pipelinejob.application.AddWorkflowDraftPortCommand.WorkflowDraft;
import com.init.pipelinejob.application.AddWorkflowDraftPortResult;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("AddWorkflowDraftPortAdapter")
class AddWorkflowDraftPortAdapterTest {

  @Mock private AddWorkflowDraftToVersionUseCase addWorkflowDraftToVersionUseCase;

  private AddWorkflowDraftPortAdapter adapter;

  @BeforeEach
  void setUp() {
    adapter = new AddWorkflowDraftPortAdapter(addWorkflowDraftToVersionUseCase);
  }

  @Test
  @DisplayName("execute — useCase 결과를 AddWorkflowDraftPortResult로 변환하여 반환한다")
  void execute_mapsResultCorrectly() {
    var command =
        new AddWorkflowDraftPortCommand(
            42L, List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
    var useCaseResult =
        new AddWorkflowDraftToVersionResult(42L, 7L, 0, 0, 0, 0, 0, 0);
    given(addWorkflowDraftToVersionUseCase.execute(org.mockito.ArgumentMatchers.any()))
        .willReturn(useCaseResult);

    AddWorkflowDraftPortResult result = adapter.execute(command);

    assertThat(result.domainPackVersionId()).isEqualTo(42L);
    assertThat(result.domainPackId()).isEqualTo(7L);
    assertThat(result.addedSlotCount()).isZero();
    assertThat(result.addedPolicyCount()).isZero();
    assertThat(result.addedRiskCount()).isZero();
    assertThat(result.addedWorkflowCount()).isZero();
    assertThat(result.addedIntentSlotBindingCount()).isZero();
    assertThat(result.addedIntentWorkflowBindingCount()).isZero();
  }

  @Test
  @DisplayName("execute — 모든 mapping 필드를 내부 커맨드로 정확히 변환한다")
  void execute_mapsAllFieldsToInternalCommand() {
    var slot = new SlotDraft("SLOT_A", "슬롯A", "설명", "STRING", false, "{}", "{}", "{}");
    var policy = new PolicyDraft("POL_A", "정책A", "설명", "HIGH", "{}", "{}", "{}", "{}");
    var risk = new RiskDraft("RISK_A", "위험A", "설명", "MEDIUM", "{}", "{}", "{}", "{}");
    var workflow = new WorkflowDraft("WF_A", "워크플로우A", "설명", "{}", "{}", "{}");
    var intentSlot = new IntentSlotBindingDraft("INT_A", "SLOT_A", true, 1, "힌트", null);
    var intentWorkflow = new IntentWorkflowBindingDraft("INT_A", "WF_A", true, null);

    var command =
        new AddWorkflowDraftPortCommand(
            10L,
            List.of(slot),
            List.of(policy),
            List.of(risk),
            List.of(workflow),
            List.of(intentSlot),
            List.of(intentWorkflow));

    var useCaseResult = new AddWorkflowDraftToVersionResult(10L, 3L, 1, 1, 1, 1, 1, 1);
    ArgumentCaptor<AddWorkflowDraftToVersionCommand> captor =
        forClass(AddWorkflowDraftToVersionCommand.class);
    given(addWorkflowDraftToVersionUseCase.execute(captor.capture())).willReturn(useCaseResult);

    AddWorkflowDraftPortResult result = adapter.execute(command);

    AddWorkflowDraftToVersionCommand captured = captor.getValue();
    assertThat(captured.domainPackVersionId()).isEqualTo(10L);
    assertThat(captured.slots()).hasSize(1);
    assertThat(captured.slots().get(0).slotCode()).isEqualTo("SLOT_A");
    assertThat(captured.policies()).hasSize(1);
    assertThat(captured.policies().get(0).policyCode()).isEqualTo("POL_A");
    assertThat(captured.risks()).hasSize(1);
    assertThat(captured.risks().get(0).riskCode()).isEqualTo("RISK_A");
    assertThat(captured.workflows()).hasSize(1);
    assertThat(captured.workflows().get(0).workflowCode()).isEqualTo("WF_A");
    assertThat(captured.intentSlotBindings()).hasSize(1);
    assertThat(captured.intentSlotBindings().get(0).intentCode()).isEqualTo("INT_A");
    assertThat(captured.intentWorkflowBindings()).hasSize(1);
    assertThat(captured.intentWorkflowBindings().get(0).workflowCode()).isEqualTo("WF_A");

    assertThat(result.addedSlotCount()).isEqualTo(1);
    assertThat(result.addedPolicyCount()).isEqualTo(1);
    assertThat(result.addedRiskCount()).isEqualTo(1);
    assertThat(result.addedWorkflowCount()).isEqualTo(1);
    assertThat(result.addedIntentSlotBindingCount()).isEqualTo(1);
    assertThat(result.addedIntentWorkflowBindingCount()).isEqualTo(1);
  }
}
