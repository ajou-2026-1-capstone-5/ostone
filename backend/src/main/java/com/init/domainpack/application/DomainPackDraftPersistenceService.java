package com.init.domainpack.application;

import static com.init.domainpack.application.DomainPackDraftPersistenceSupport.indexByCode;

import com.init.domainpack.application.exception.DomainPackDraftRequestInvalidException;
import com.init.domainpack.application.exception.DomainPackVersionNotDraftException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.workflowruntime.application.matching.WorkflowMatchingProfileBuildRequestService;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class DomainPackDraftPersistenceService {

  private final DomainPackVersionRepository domainPackVersionRepository;
  private final DomainPackVersionCloneService domainPackVersionCloneService;
  private final WorkflowMatchingProfileBuildRequestService profileBuildRequestService;
  private final DomainPackDraftIntentPersister intentPersister;
  private final DomainPackDraftWorkflowMapper workflowMapper;
  private final DomainPackDraftComponentPersister componentPersister;

  public DomainPackDraftPersistenceService(
      DomainPackVersionRepository domainPackVersionRepository,
      DomainPackVersionCloneService domainPackVersionCloneService,
      WorkflowMatchingProfileBuildRequestService profileBuildRequestService,
      DomainPackDraftIntentPersister intentPersister,
      DomainPackDraftWorkflowMapper workflowMapper,
      DomainPackDraftComponentPersister componentPersister) {
    this.domainPackVersionRepository = domainPackVersionRepository;
    this.domainPackVersionCloneService = domainPackVersionCloneService;
    this.profileBuildRequestService = profileBuildRequestService;
    this.intentPersister = intentPersister;
    this.workflowMapper = workflowMapper;
    this.componentPersister = componentPersister;
  }

  /** DRAFT 버전만 생성한다 (intent/slot/policy 등은 저장하지 않음). Airflow 파이프라인 콜백의 1단계에서 사용한다. */
  @Transactional
  public PersistDomainPackVersionResult persistVersion(PersistDomainPackVersionCommand command) {
    DomainPackVersion version =
        domainPackVersionCloneService.createEmptyDraft(
            new DomainPackVersionCreateCommand(
                command.workspaceId(),
                command.packId(),
                command.createdBy(),
                command.sourcePipelineJobId(),
                command.summaryJson()));
    return new PersistDomainPackVersionResult(version);
  }

  /** 기존 DRAFT 버전에 intent를 추가 저장한다. 이미 존재하는 intentCode는 건너뛴다. Airflow 파이프라인 콜백의 2단계에서 사용한다. */
  @Transactional
  public AddIntentsToDraftVersionResult persistIntents(
      Long domainPackVersionId, List<IntentDraft> intents) {
    DomainPackVersion version = requireDraftVersion(domainPackVersionId);
    PersistedDraftIntents persistedIntents =
        intentPersister.addIntents(domainPackVersionId, intents);

    return new AddIntentsToDraftVersionResult(
        domainPackVersionId,
        version.getDomainPackId(),
        persistedIntents.savedIntents().size(),
        persistedIntents.skippedIntentCount(),
        persistedIntents.totalIntentCount());
  }

  /** UI에서 수동으로 전체 draft를 한 번에 저장할 때 사용한다. */
  @Transactional
  public CreateDomainPackDraftResult persist(CreateDomainPackDraftCommand command) {
    DraftComponentsInput components = DomainPackDraftInputMapper.fromCreateCommand(command);
    List<WorkflowInput> validatedWorkflows =
        workflowMapper.validateDraftPayload(
            new DraftPayload(
                command.intents(),
                components.slots(),
                components.intentSlotBindings(),
                components.policies(),
                components.risks(),
                components.workflows()),
            Set.of());

    DomainPackVersion savedVersion =
        domainPackVersionCloneService.createEmptyDraft(
            new DomainPackVersionCreateCommand(
                command.workspaceId(),
                command.packId(),
                command.userId(),
                command.sourcePipelineJobId(),
                command.summaryJson()));

    List<IntentDefinition> savedIntents =
        intentPersister.saveAll(savedVersion.getId(), command.intents());
    Map<String, IntentDefinition> intentsByCode =
        indexByCode(savedIntents, IntentDefinition::getIntentCode);

    SavedDraftComponents savedComponents =
        componentPersister.save(
            savedVersion.getId(),
            intentsByCode,
            new DraftComponentsInput(
                components.slots(),
                components.policies(),
                components.risks(),
                validatedWorkflows,
                components.intentSlotBindings()));
    enqueueWorkflowProfileBuild(savedVersion.getId(), savedComponents, "DRAFT_IMPORT");

    return CreateDomainPackDraftResult.from(
        savedVersion,
        savedIntents.size(),
        savedComponents.addedSlotCount(),
        savedComponents.addedPolicyCount(),
        savedComponents.addedRiskCount(),
        savedComponents.addedWorkflowCount());
  }

  /** 기존 DRAFT 버전에 workflow 관련 초안을 추가 저장한다. intent는 새로 만들지 않고 기존 row를 참조한다. */
  @Transactional
  public AddWorkflowDraftToVersionResult persistWorkflowDraft(
      Long domainPackVersionId,
      List<AddWorkflowDraftToVersionCommand.SlotDraft> slots,
      List<AddWorkflowDraftToVersionCommand.PolicyDraft> policies,
      List<AddWorkflowDraftToVersionCommand.RiskDraft> risks,
      List<AddWorkflowDraftToVersionCommand.WorkflowDraft> workflows,
      List<AddWorkflowDraftToVersionCommand.IntentSlotBindingDraft> intentSlotBindings) {
    DomainPackVersion version = requireDraftVersion(domainPackVersionId);
    DraftComponentsInput components =
        DomainPackDraftInputMapper.fromWorkflowCallback(
            slots, policies, risks, workflows, intentSlotBindings);
    validateNonEmptyWorkflowDraft(components);

    List<WorkflowInput> validatedWorkflows =
        workflowMapper.validateWorkflowDraft(domainPackVersionId, components);

    SavedDraftComponents savedComponents =
        componentPersister.save(
            domainPackVersionId,
            intentPersister.findByVersionIdIndexed(domainPackVersionId),
            new DraftComponentsInput(
                components.slots(),
                components.policies(),
                components.risks(),
                validatedWorkflows,
                components.intentSlotBindings()));
    enqueueWorkflowProfileBuild(domainPackVersionId, savedComponents, "WORKFLOW_DRAFT_IMPORT");

    return new AddWorkflowDraftToVersionResult(
        domainPackVersionId,
        version.getDomainPackId(),
        savedComponents.addedSlotCount(),
        savedComponents.addedPolicyCount(),
        savedComponents.addedRiskCount(),
        savedComponents.addedWorkflowCount(),
        savedComponents.addedIntentSlotBindingCount());
  }

  private void validateNonEmptyWorkflowDraft(DraftComponentsInput components) {
    if (components.slots().isEmpty()
        && components.policies().isEmpty()
        && components.risks().isEmpty()
        && components.workflows().isEmpty()
        && components.intentSlotBindings().isEmpty()) {
      throw new DomainPackDraftRequestInvalidException("workflow draft payload는 비어 있을 수 없습니다.");
    }
  }

  private void enqueueWorkflowProfileBuild(
      Long domainPackVersionId, SavedDraftComponents savedComponents, String source) {
    if (savedComponents.addedWorkflowCount() > 0) {
      profileBuildRequestService.enqueue(domainPackVersionId, source);
    }
  }

  private DomainPackVersion requireDraftVersion(Long domainPackVersionId) {
    DomainPackVersion version =
        domainPackVersionRepository
            .findById(domainPackVersionId)
            .orElseThrow(() -> new DomainPackVersionNotFoundException(domainPackVersionId));
    if (!DomainPackVersion.STATUS_DRAFT.equals(version.getLifecycleStatus())) {
      throw new DomainPackVersionNotDraftException(domainPackVersionId);
    }
    return version;
  }
}
