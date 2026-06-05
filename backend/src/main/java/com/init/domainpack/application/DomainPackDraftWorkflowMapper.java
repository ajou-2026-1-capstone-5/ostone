package com.init.domainpack.application;

import static com.init.domainpack.application.DomainPackDraftPersistenceSupport.ensureUnique;
import static com.init.domainpack.application.DomainPackDraftPersistenceSupport.safeList;

import com.init.domainpack.application.exception.WorkflowActionNodePolicyRefNotFoundException;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.stereotype.Service;

@Service
class DomainPackDraftWorkflowMapper {

  private final PolicyDefinitionRepository policyDefinitionRepository;

  DomainPackDraftWorkflowMapper(PolicyDefinitionRepository policyDefinitionRepository) {
    this.policyDefinitionRepository = policyDefinitionRepository;
  }

  List<WorkflowInput> validateDraftPayload(DraftPayload payload, Set<String> allowedPolicyCodes) {
    ensureDraftPayloadUnique(
        payload.intents(),
        payload.slots(),
        payload.intentSlotBindings(),
        payload.policies(),
        payload.risks(),
        payload.workflows());
    return validateParsedWorkflows(
        parseWorkflowInputs(safeList(payload.workflows())), payload.policies(), allowedPolicyCodes);
  }

  List<WorkflowInput> validateWorkflowDraft(
      Long domainPackVersionId, DraftComponentsInput components) {
    ensureDraftPayloadUnique(
        List.of(),
        components.slots(),
        components.intentSlotBindings(),
        components.policies(),
        components.risks(),
        components.workflows());
    List<ParsedWorkflowInput> parsedWorkflows = parseWorkflowInputs(components.workflows());
    Set<String> submittedPolicyCodes =
        components.policies().stream().map(PolicyInput::policyCode).collect(Collectors.toSet());
    Set<String> existingPolicyCodes =
        findExistingPolicyCodes(domainPackVersionId, collectWorkflowPolicyRefs(parsedWorkflows));
    Set<String> allowedPolicyCodes =
        Stream.concat(submittedPolicyCodes.stream(), existingPolicyCodes.stream())
            .collect(Collectors.toSet());
    return validateParsedWorkflows(parsedWorkflows, components.policies(), allowedPolicyCodes);
  }

  private void ensureDraftPayloadUnique(
      List<IntentDraft> intents,
      List<SlotInput> slots,
      List<IntentSlotBindingInput> intentSlotBindings,
      List<PolicyInput> policies,
      List<RiskInput> risks,
      List<WorkflowInput> workflows) {
    ensureUnique(safeList(intents), IntentDraft::intentCode, "intentCode");
    ensureUnique(safeList(slots), SlotInput::slotCode, "slotCode");
    ensureUnique(safeList(policies), PolicyInput::policyCode, "policyCode");
    ensureUnique(safeList(risks), RiskInput::riskCode, "riskCode");
    ensureUnique(safeList(workflows), WorkflowInput::workflowCode, "workflowCode");
    ensureUnique(
        safeList(intentSlotBindings),
        binding -> binding.intentCode() + "::" + binding.slotCode(),
        "intentSlotBinding");
  }

  private List<WorkflowInput> validateParsedWorkflows(
      List<ParsedWorkflowInput> workflows,
      List<PolicyInput> policies,
      Set<String> allowedPolicyCodes) {
    Set<String> submittedPolicyCodes =
        safeList(policies).stream().map(PolicyInput::policyCode).collect(Collectors.toSet());
    Set<String> policyCodes =
        Stream.concat(submittedPolicyCodes.stream(), allowedPolicyCodes.stream())
            .collect(Collectors.toSet());
    return workflows.stream().map(w -> validateAndNormalizeWorkflow(w, policyCodes)).toList();
  }

  private WorkflowInput validateAndNormalizeWorkflow(
      ParsedWorkflowInput parsedWorkflow, Set<String> allowedPolicyCodes) {
    WorkflowInput workflow = parsedWorkflow.workflow();
    WorkflowGraphValidator.ParsedGraph graph = parsedWorkflow.graph();
    graph.nodes().stream()
        .filter(n -> "ACTION".equals(n.type()))
        .map(WorkflowGraphValidator.GraphNode::policyRef)
        .filter(ref -> !allowedPolicyCodes.contains(ref))
        .findFirst()
        .ifPresent(
            ref -> {
              throw new WorkflowActionNodePolicyRefNotFoundException(ref);
            });
    return new WorkflowInput(
        workflow.workflowCode(),
        workflow.name(),
        workflow.description(),
        workflow.graphJson(),
        WorkflowGraphValidator.extractInitialState(graph),
        WorkflowGraphValidator.extractTerminalStatesJson(graph),
        workflow.evidenceJson(),
        workflow.metaJson(),
        workflow.intentCode(),
        workflow.isPrimary(),
        workflow.routeConditionJson());
  }

  private Set<String> collectWorkflowPolicyRefs(List<ParsedWorkflowInput> workflows) {
    return workflows.stream()
        .flatMap(workflow -> workflow.graph().nodes().stream())
        .filter(node -> "ACTION".equals(node.type()))
        .map(WorkflowGraphValidator.GraphNode::policyRef)
        .collect(Collectors.toSet());
  }

  private List<ParsedWorkflowInput> parseWorkflowInputs(List<WorkflowInput> workflows) {
    return workflows.stream()
        .map(
            workflow ->
                new ParsedWorkflowInput(
                    workflow,
                    WorkflowGraphValidator.parseAndValidate(
                        workflow.graphJson(), workflow.workflowCode())))
        .toList();
  }

  private Set<String> findExistingPolicyCodes(Long domainPackVersionId, Set<String> policyCodes) {
    if (policyCodes.isEmpty()) {
      return Set.of();
    }
    return policyDefinitionRepository.findExistingPolicyCodesByVersionIdAndCodes(
        domainPackVersionId, policyCodes);
  }

  private record ParsedWorkflowInput(
      WorkflowInput workflow, WorkflowGraphValidator.ParsedGraph graph) {}
}
