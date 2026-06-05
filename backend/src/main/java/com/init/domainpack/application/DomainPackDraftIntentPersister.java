package com.init.domainpack.application;

import static com.init.domainpack.application.DomainPackDraftPersistenceSupport.ensureUnique;
import static com.init.domainpack.application.DomainPackDraftPersistenceSupport.indexByCode;
import static com.init.domainpack.application.DomainPackDraftPersistenceSupport.requireByCode;
import static com.init.domainpack.application.DomainPackDraftPersistenceSupport.safeList;

import com.init.domainpack.application.exception.DomainPackDraftRequestInvalidException;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
class DomainPackDraftIntentPersister {

  private final IntentDefinitionRepository intentDefinitionRepository;

  DomainPackDraftIntentPersister(IntentDefinitionRepository intentDefinitionRepository) {
    this.intentDefinitionRepository = intentDefinitionRepository;
  }

  PersistedDraftIntents addIntents(Long domainPackVersionId, List<IntentDraft> intents) {
    List<IntentDraft> safeIntents = safeList(intents);
    ensureUnique(safeIntents, IntentDraft::intentCode, "intentCode");

    List<IntentDraft> newIntents =
        safeIntents.stream()
            .filter(
                intent ->
                    !intentDefinitionRepository.existsByDomainPackVersionIdAndIntentCode(
                        domainPackVersionId, intent.intentCode()))
            .toList();
    int skippedCount = safeIntents.size() - newIntents.size();

    List<IntentDefinition> savedIntents = saveAll(domainPackVersionId, newIntents);
    long totalCount = intentDefinitionRepository.countByDomainPackVersionId(domainPackVersionId);
    return new PersistedDraftIntents(savedIntents, skippedCount, (int) totalCount);
  }

  List<IntentDefinition> saveAll(Long domainPackVersionId, List<IntentDraft> intents) {
    List<IntentDraft> safeIntents = safeList(intents);
    List<IntentDefinition> savedIntents =
        intentDefinitionRepository.saveAllAndFlush(
            safeIntents.stream().map(intent -> createIntent(domainPackVersionId, intent)).toList());
    return linkParentIntents(domainPackVersionId, savedIntents, safeIntents);
  }

  Map<String, IntentDefinition> findByVersionIdIndexed(Long domainPackVersionId) {
    return indexByCode(
        intentDefinitionRepository.findByDomainPackVersionId(domainPackVersionId),
        IntentDefinition::getIntentCode);
  }

  private IntentDefinition createIntent(Long domainPackVersionId, IntentDraft intent) {
    return IntentDefinition.create(
        domainPackVersionId,
        intent.intentCode(),
        intent.name(),
        intent.description(),
        intent.taxonomyLevel(),
        intent.sourceClusterRef(),
        intent.entryConditionJson(),
        intent.evidenceJson(),
        intent.metaJson());
  }

  private List<IntentDefinition> linkParentIntents(
      Long domainPackVersionId, List<IntentDefinition> savedIntents, List<IntentDraft> drafts) {
    Map<String, IntentDefinition> intentsByCode =
        indexByCode(savedIntents, IntentDefinition::getIntentCode);

    boolean hasParentIntent = false;
    for (IntentDraft draft : drafts) {
      if (draft.parentIntentCode() == null || draft.parentIntentCode().isBlank()) {
        continue;
      }
      hasParentIntent = true;
      IntentDefinition child = requireByCode(intentsByCode, draft.intentCode(), "intent");
      IntentDefinition parent =
          resolveParentIntent(domainPackVersionId, intentsByCode, draft.parentIntentCode());
      if (parent == null) {
        throw new DomainPackDraftRequestInvalidException(
            "parentIntentCode를 찾을 수 없습니다. intentCode="
                + draft.intentCode()
                + ", parentIntentCode="
                + draft.parentIntentCode());
      }
      child.assignParent(parent.getId());
    }
    if (!hasParentIntent) {
      return savedIntents;
    }
    return intentDefinitionRepository.saveAllAndFlush(savedIntents);
  }

  private IntentDefinition resolveParentIntent(
      Long domainPackVersionId,
      Map<String, IntentDefinition> intentsByCode,
      String parentIntentCode) {
    IntentDefinition parent = intentsByCode.get(parentIntentCode);
    if (parent != null) {
      return parent;
    }
    return intentDefinitionRepository
        .findByDomainPackVersionIdAndIntentCode(domainPackVersionId, parentIntentCode)
        .orElse(null);
  }
}
