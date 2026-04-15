package com.init.domainpack.application;

import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UpdateWorkflowUseCase {

  private static final int MAX_GRAPH_JSON_CHARS = 100_000;

  private final DomainPackValidator validator;
  private final DomainPackVersionRepository versionRepository;
  private final WorkflowDefinitionRepository workflowRepository;

  public UpdateWorkflowUseCase(
      DomainPackValidator validator,
      DomainPackVersionRepository versionRepository,
      WorkflowDefinitionRepository workflowRepository) {
    this.validator = validator;
    this.versionRepository = versionRepository;
    this.workflowRepository = workflowRepository;
  }

  @Transactional
  public WorkflowDefinitionDetail execute(UpdateWorkflowCommand command) {
    validator.validateWorkspaceAccess(command.workspaceId(), command.requesterId());
    validator.validateDomainPack(command.packId(), command.workspaceId());

    DomainPackVersion version =
        versionRepository
            .findById(command.versionId())
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "NOT_FOUND", "버전을 찾을 수 없습니다: " + command.versionId()));
    if (!version.getDomainPackId().equals(command.packId())) {
      throw new NotFoundException("NOT_FOUND", "버전을 찾을 수 없습니다: " + command.versionId());
    }
    if (!DomainPackVersion.STATUS_DRAFT.equals(version.getLifecycleStatus())) {
      throw new BadRequestException(
          "WORKFLOW_NOT_EDITABLE", "DRAFT 상태의 버전에서만 수정할 수 있습니다.");
    }

    if (command.graphJson().length() > MAX_GRAPH_JSON_CHARS) {
      throw new BadRequestException(
          "GRAPH_JSON_TOO_LARGE",
          "graphJson이 허용 크기(" + MAX_GRAPH_JSON_CHARS + "자)를 초과합니다.");
    }

    WorkflowDefinition workflow =
        workflowRepository
            .findByIdAndDomainPackVersionId(command.workflowId(), command.versionId())
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "NOT_FOUND", "워크플로우를 찾을 수 없습니다: " + command.workflowId()));

    // V1–V6 예외는 GlobalExceptionHandler로 전파
    WorkflowGraphValidator.ParsedGraph parsed =
        WorkflowGraphValidator.parseAndValidate(command.graphJson(), workflow.getWorkflowCode());
    String initialState = WorkflowGraphValidator.extractInitialState(parsed);
    String terminalStatesJson = WorkflowGraphValidator.extractTerminalStatesJson(parsed);

    try {
      workflow.updateGraph(
          command.name(),
          command.description(),
          command.graphJson(),
          initialState,
          terminalStatesJson);
    } catch (IllegalArgumentException e) {
      throw new BadRequestException("VALIDATION_ERROR", e.getMessage());
    }

    workflowRepository.save(workflow);
    return WorkflowDefinitionDetail.from(workflow);
  }
}
