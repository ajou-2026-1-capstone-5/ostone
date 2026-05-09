package com.init.domainpack.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.domainpack.application.exception.DomainPackDraftAlreadyExistsException;
import com.init.domainpack.application.exception.DomainPackDraftRequestInvalidException;
import com.init.domainpack.application.exception.DomainPackNotFoundException;
import com.init.domainpack.application.exception.DomainPackVersionConflictException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.IntentSlotBinding;
import com.init.domainpack.domain.model.IntentWorkflowBinding;
import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.domain.model.RiskDefinition;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.IntentSlotBindingRepository;
import com.init.domainpack.domain.repository.IntentWorkflowBindingRepository;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.function.ToLongFunction;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class DomainPackVersionCloneService {

  private final DomainPackRepository domainPackRepository;
  private final DomainPackVersionRepository versionRepository;
  private final IntentDefinitionRepository intentRepository;
  private final SlotDefinitionRepository slotRepository;
  private final PolicyDefinitionRepository policyRepository;
  private final RiskDefinitionRepository riskRepository;
  private final WorkflowDefinitionRepository workflowRepository;
  private final IntentSlotBindingRepository intentSlotBindingRepository;
  private final IntentWorkflowBindingRepository intentWorkflowBindingRepository;
  private final ObjectMapper objectMapper;

  public DomainPackVersionCloneService(
      DomainPackRepository domainPackRepository,
      DomainPackVersionRepository versionRepository,
      IntentDefinitionRepository intentRepository,
      SlotDefinitionRepository slotRepository,
      PolicyDefinitionRepository policyRepository,
      RiskDefinitionRepository riskRepository,
      WorkflowDefinitionRepository workflowRepository,
      IntentSlotBindingRepository intentSlotBindingRepository,
      IntentWorkflowBindingRepository intentWorkflowBindingRepository,
      ObjectMapper objectMapper) {
    this.domainPackRepository = domainPackRepository;
    this.versionRepository = versionRepository;
    this.intentRepository = intentRepository;
    this.slotRepository = slotRepository;
    this.policyRepository = policyRepository;
    this.riskRepository = riskRepository;
    this.workflowRepository = workflowRepository;
    this.intentSlotBindingRepository = intentSlotBindingRepository;
    this.intentWorkflowBindingRepository = intentWorkflowBindingRepository;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public DomainPackVersionCloneResult cloneVersion(DomainPackVersionCloneCommand command) {
    lockPackAndEnsureNoDraft(command.workspaceId(), command.packId());

    int nextVersionNo =
        versionRepository.findMaxVersionNoByDomainPackId(command.packId()).orElse(0) + 1;
    DomainPackVersion draft =
        DomainPackVersion.createDraft(
            command.packId(),
            nextVersionNo,
            command.createdBy(),
            null,
            buildSummaryJson(command.baseVersion(), command.sourceType(), command.reason()));

    DomainPackVersion savedDraft;
    try {
      savedDraft = versionRepository.saveAndFlush(draft);
    } catch (DataIntegrityViolationException | ObjectOptimisticLockingFailureException ex) {
      throw new DomainPackVersionConflictException(command.packId(), ex);
    }
    cloneComponents(command.baseVersion().getId(), savedDraft.getId());

    return DomainPackVersionCloneResult.from(
        savedDraft, command.sourceType(), command.baseVersion(), command.reason());
  }

  @Transactional
  public DomainPackVersion createEmptyDraft(DomainPackVersionCreateCommand command) {
    lockPackAndEnsureNoDraft(command.workspaceId(), command.packId());
    int nextVersionNo =
        versionRepository.findMaxVersionNoByDomainPackId(command.packId()).orElse(0) + 1;
    DomainPackVersion draft =
        DomainPackVersion.createDraft(
            command.packId(),
            nextVersionNo,
            command.createdBy(),
            command.sourcePipelineJobId(),
            command.summaryJson());
    try {
      return versionRepository.saveAndFlush(draft);
    } catch (DataIntegrityViolationException | ObjectOptimisticLockingFailureException ex) {
      throw new DomainPackVersionConflictException(command.packId(), ex);
    }
  }

  private void lockPackAndEnsureNoDraft(Long workspaceId, Long packId) {
    domainPackRepository
        .findByIdAndWorkspaceIdForUpdate(packId, workspaceId)
        .orElseThrow(() -> new DomainPackNotFoundException(packId));
    if (versionRepository.existsByDomainPackIdAndLifecycleStatus(
        packId, DomainPackVersion.STATUS_DRAFT)) {
      throw new DomainPackDraftAlreadyExistsException(packId);
    }
  }

  private void cloneComponents(Long sourceVersionId, Long targetVersionId) {
    List<IntentDefinition> sourceIntents =
        intentRepository.findByDomainPackVersionId(sourceVersionId);
    List<SlotDefinition> sourceSlots =
        slotRepository.findAllByDomainPackVersionIdOrderBySlotCodeAsc(sourceVersionId);
    List<PolicyDefinition> sourcePolicies =
        policyRepository.findAllByDomainPackVersionIdOrderByPolicyCodeAsc(sourceVersionId);
    List<RiskDefinition> sourceRisks =
        riskRepository.findAllByDomainPackVersionIdOrderByRiskCodeAsc(sourceVersionId);
    List<WorkflowDefinition> sourceWorkflows =
        workflowRepository.findAllByDomainPackVersionId(sourceVersionId);

    List<IntentDefinition> copiedIntents =
        intentRepository.saveAllAndFlush(
            sourceIntents.stream()
                .map(intent -> IntentDefinition.copyToVersion(intent, targetVersionId))
                .toList());
    Map<String, IntentDefinition> copiedIntentsByCode =
        indexBy(copiedIntents, IntentDefinition::getIntentCode, "intentCode");
    Map<Long, Long> intentIdMap = new LinkedHashMap<>();
    for (IntentDefinition source : sourceIntents) {
      IntentDefinition copied = copiedIntentsByCode.get(source.getIntentCode());
      if (copied == null) {
        throw new DomainPackDraftRequestInvalidException("intent 복제 매핑에 실패했습니다.");
      }
      intentIdMap.put(source.getId(), copied.getId());
    }
    remapParentIntents(sourceIntents, copiedIntentsByCode, intentIdMap);

    List<SlotDefinition> copiedSlots =
        slotRepository.saveAllAndFlush(
            sourceSlots.stream()
                .map(slot -> SlotDefinition.copyToVersion(slot, targetVersionId))
                .toList());
    Map<Long, Long> slotIdMap =
        mapIdsByCode(
            sourceSlots,
            copiedSlots,
            SlotDefinition::getSlotCode,
            SlotDefinition::getId,
            "slotCode");

    policyRepository.saveAllAndFlush(
        sourcePolicies.stream()
            .map(policy -> PolicyDefinition.copyToVersion(policy, targetVersionId))
            .toList());
    riskRepository.saveAllAndFlush(
        sourceRisks.stream()
            .map(risk -> RiskDefinition.copyToVersion(risk, targetVersionId))
            .toList());

    List<WorkflowDefinition> copiedWorkflows =
        workflowRepository.saveAllAndFlush(
            sourceWorkflows.stream()
                .map(workflow -> WorkflowDefinition.copyToVersion(workflow, targetVersionId))
                .toList());
    Map<Long, Long> workflowIdMap =
        mapIdsByCode(
            sourceWorkflows,
            copiedWorkflows,
            WorkflowDefinition::getWorkflowCode,
            WorkflowDefinition::getId,
            "workflowCode");

    cloneBindings(sourceIntents, intentIdMap, slotIdMap, workflowIdMap);
  }

  private void remapParentIntents(
      List<IntentDefinition> sourceIntents,
      Map<String, IntentDefinition> copiedIntentsByCode,
      Map<Long, Long> intentIdMap) {
    boolean changed = false;
    for (IntentDefinition source : sourceIntents) {
      if (source.getParentIntentId() == null) {
        continue;
      }
      Long copiedParentId = intentIdMap.get(source.getParentIntentId());
      if (copiedParentId == null) {
        throw new DomainPackDraftRequestInvalidException("parent intent 복제 매핑에 실패했습니다.");
      }
      copiedIntentsByCode.get(source.getIntentCode()).assignParent(copiedParentId);
      changed = true;
    }
    if (changed) {
      intentRepository.saveAllAndFlush(copiedIntentsByCode.values());
    }
  }

  private void cloneBindings(
      List<IntentDefinition> sourceIntents,
      Map<Long, Long> intentIdMap,
      Map<Long, Long> slotIdMap,
      Map<Long, Long> workflowIdMap) {
    List<Long> sourceIntentIds = sourceIntents.stream().map(IntentDefinition::getId).toList();
    if (sourceIntentIds.isEmpty()) {
      return;
    }
    intentSlotBindingRepository.saveAll(
        intentSlotBindingRepository.findAllByIntentDefinitionIdIn(sourceIntentIds).stream()
            .map(
                binding ->
                    IntentSlotBinding.create(
                        requireMapped(intentIdMap, binding.getIntentDefinitionId(), "intent"),
                        requireMapped(slotIdMap, binding.getSlotDefinitionId(), "slot"),
                        binding.getIsRequired(),
                        binding.getCollectionOrder(),
                        binding.getPromptHint(),
                        binding.getConditionJson()))
            .toList());
    intentWorkflowBindingRepository.saveAll(
        intentWorkflowBindingRepository.findAllByIntentDefinitionIdIn(sourceIntentIds).stream()
            .map(
                binding ->
                    IntentWorkflowBinding.create(
                        requireMapped(intentIdMap, binding.getIntentDefinitionId(), "intent"),
                        requireMapped(workflowIdMap, binding.getWorkflowDefinitionId(), "workflow"),
                        binding.getIsPrimary(),
                        binding.getRouteConditionJson()))
            .toList());
  }

  private String buildSummaryJson(
      DomainPackVersion baseVersion, DomainPackDraftSourceType sourceType, String reason) {
    ObjectNode root = readSummaryRoot(baseVersion.getSummaryJson());
    ObjectNode draftSource = objectMapper.createObjectNode();
    draftSource.put("type", sourceType.name());
    draftSource.put("baseVersionId", baseVersion.getId());
    draftSource.put("baseVersionNo", baseVersion.getVersionNo());
    if (reason != null) {
      draftSource.put("reason", reason);
    }
    root.set("draftSource", draftSource);
    try {
      return objectMapper.writeValueAsString(root);
    } catch (JsonProcessingException ex) {
      throw new DomainPackDraftRequestInvalidException("summaryJson 직렬화에 실패했습니다.", ex);
    }
  }

  private ObjectNode readSummaryRoot(String summaryJson) {
    if (summaryJson == null || summaryJson.isBlank()) {
      return objectMapper.createObjectNode();
    }
    JsonNode node;
    try {
      node = objectMapper.readTree(summaryJson);
    } catch (JsonProcessingException ex) {
      throw new DomainPackDraftRequestInvalidException("summaryJson은 유효한 JSON이어야 합니다.", ex);
    }
    if (!node.isObject()) {
      throw new DomainPackDraftRequestInvalidException("summaryJson은 JSON object 문자열이어야 합니다.");
    }
    return (ObjectNode) node;
  }

  private <T> Map<String, T> indexBy(
      List<T> values, Function<T, String> keyExtractor, String fieldName) {
    Map<String, T> indexed = new LinkedHashMap<>();
    for (T value : values) {
      String key = keyExtractor.apply(value);
      if (indexed.put(key, value) != null) {
        throw new DomainPackDraftRequestInvalidException("중복된 " + fieldName + " 값이 존재합니다.");
      }
    }
    return indexed;
  }

  private <T> Map<Long, Long> mapIdsByCode(
      List<T> sources,
      List<T> copies,
      Function<T, String> codeExtractor,
      ToLongFunction<T> idExtractor,
      String fieldName) {
    Map<String, T> copiesByCode = indexBy(copies, codeExtractor, fieldName);
    Map<Long, Long> idMap = new LinkedHashMap<>();
    for (T source : sources) {
      T copy = copiesByCode.get(codeExtractor.apply(source));
      if (copy == null) {
        throw new DomainPackDraftRequestInvalidException(fieldName + " 복제 매핑에 실패했습니다.");
      }
      idMap.put(idExtractor.applyAsLong(source), idExtractor.applyAsLong(copy));
    }
    return idMap;
  }

  private Long requireMapped(Map<Long, Long> idMap, Long sourceId, String resourceName) {
    Long mappedId = idMap.get(sourceId);
    if (mappedId == null) {
      throw new DomainPackDraftRequestInvalidException(resourceName + " 복제 매핑에 실패했습니다.");
    }
    return mappedId;
  }
}
