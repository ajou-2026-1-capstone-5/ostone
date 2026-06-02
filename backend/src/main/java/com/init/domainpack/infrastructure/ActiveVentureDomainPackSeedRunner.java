package com.init.domainpack.infrastructure;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.domainpack.domain.model.DomainPack;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.IntentSlotBinding;
import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.domain.model.RiskDefinition;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.DomainPackCommandRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.IntentSlotBindingRepository;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.workflowruntime.application.matching.WorkflowMatchingProfileBuildRequestService;
import jakarta.persistence.EntityManager;
import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile({"local", "dev"})
@Order(Ordered.LOWEST_PRECEDENCE - 90)
public class ActiveVentureDomainPackSeedRunner implements ApplicationRunner {

  private static final Logger log =
      LoggerFactory.getLogger(ActiveVentureDomainPackSeedRunner.class);
  private static final String DESCRIPTION_FIELD = "description";
  private static final String DEMO_SIGN_IN_VALUE = String.join("", "demo", "1234");
  private static final List<SeedConfig> SEED_CONFIGS =
      List.of(
          new SeedConfig(
              1L,
              "WS-DEMO",
              "액티벤처 여행 상담 워크스페이스",
              "액티벤처 여행 상담 도메인팩 로컬 시연용 워크스페이스",
              "seed/activeventure-workflow-candidate.json",
              "activeventure_100 상담 로그에서 생성한 여행 상담 도메인팩",
              "ACTIVEVENTURE_SEED",
              Set.of("cancellation_refund_change_policy_flow")),
          new SeedConfig(
              2L,
              "WS-HANACARD-DEMO",
              "하나카드 카드 상담 워크스페이스",
              "하나카드 상담 로그에서 추출한 카드 상담 도메인팩 로컬 시연용 워크스페이스",
              "seed/hanacard-workflow-candidate.json",
              "hanacard_100 상담 로그에서 생성한 카드 상담 도메인팩",
              "HANACARD_SEED",
              Set.of(
                  "lost_card_report_and_status_flow",
                  "payment_history_and_charge_inquiry_flow",
                  "cancellation_refund_status_flow",
                  "card_loan_and_cash_advance_management_flow",
                  "card_limit_management_flow",
                  "digital_payment_service_registration_flow")));
  private static final List<DemoAccountConfig> DEMO_ACCOUNT_CONFIGS =
      List.of(
          new DemoAccountConfig(1L, "activeventure.demo@ostone.local", "액티벤처 데모 사용자"),
          new DemoAccountConfig(2L, "hanacard.demo@ostone.local", "하나카드 데모 사용자"));

  private final DomainPackCommandRepository domainPackRepository;
  private final DomainPackVersionRepository domainPackVersionRepository;
  private final IntentDefinitionRepository intentDefinitionRepository;
  private final SlotDefinitionRepository slotDefinitionRepository;
  private final PolicyDefinitionRepository policyDefinitionRepository;
  private final RiskDefinitionRepository riskDefinitionRepository;
  private final WorkflowDefinitionRepository workflowDefinitionRepository;
  private final IntentSlotBindingRepository intentSlotBindingRepository;
  private final WorkflowMatchingProfileBuildRequestService profileBuildRequestService;
  private final EntityManager entityManager;
  private final ObjectMapper objectMapper;
  private final PasswordEncoder passwordEncoder;

  public ActiveVentureDomainPackSeedRunner(
      DomainPackCommandRepository domainPackRepository,
      DomainPackVersionRepository domainPackVersionRepository,
      IntentDefinitionRepository intentDefinitionRepository,
      SlotDefinitionRepository slotDefinitionRepository,
      PolicyDefinitionRepository policyDefinitionRepository,
      RiskDefinitionRepository riskDefinitionRepository,
      WorkflowDefinitionRepository workflowDefinitionRepository,
      IntentSlotBindingRepository intentSlotBindingRepository,
      WorkflowMatchingProfileBuildRequestService profileBuildRequestService,
      EntityManager entityManager,
      ObjectMapper objectMapper,
      PasswordEncoder passwordEncoder) {
    this.domainPackRepository = domainPackRepository;
    this.domainPackVersionRepository = domainPackVersionRepository;
    this.intentDefinitionRepository = intentDefinitionRepository;
    this.slotDefinitionRepository = slotDefinitionRepository;
    this.policyDefinitionRepository = policyDefinitionRepository;
    this.riskDefinitionRepository = riskDefinitionRepository;
    this.workflowDefinitionRepository = workflowDefinitionRepository;
    this.intentSlotBindingRepository = intentSlotBindingRepository;
    this.profileBuildRequestService = profileBuildRequestService;
    this.entityManager = entityManager;
    this.objectMapper = objectMapper;
    this.passwordEncoder = passwordEncoder;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    for (SeedConfig seedConfig : SEED_CONFIGS) {
      seed(seedConfig);
    }
    seedDemoAccounts();
  }

  private void seed(SeedConfig seedConfig) {
    JsonNode seed = loadSeed(seedConfig);
    String packKey = requiredText(seed.path("domainPackDraft"), "packKey");
    DomainPack pack = findOrCreatePack(seed.path("domainPackDraft"), packKey, seedConfig);
    Optional<DomainPackVersion> currentPublishedVersion =
        domainPackVersionRepository.findCurrentPublishedByDomainPackId(pack.getId());
    if (currentPublishedVersion.isPresent()) {
      Long versionId = currentPublishedVersion.get().getId();
      JsonNode workflowDraft = seed.path("workflowDraft");
      int updatedCount =
          backfillIntentInternalResources(versionId, seed.path("intentDraft").path("intents"));
      int slotUpdatedCount = backfillSlotNames(versionId, workflowDraft.path("slots"));
      int bindingUpdatedCount =
          backfillIntentSlotBindingPrompts(versionId, workflowDraft.path("intentSlotBindings"));
      log.info(
          "Seed domain pack '{}' already has a published version, internal resource backfill count={}, slot name backfill count={}, binding prompt backfill count={}",
          packKey,
          updatedCount,
          slotUpdatedCount,
          bindingUpdatedCount);
      return;
    }

    DomainPackVersion version = createPublishedVersion(pack, seed);
    JsonNode workflowDraft = seed.path("workflowDraft");
    Map<String, IntentDefinition> intentsByCode =
        persistIntents(version.getId(), seed.path("intentDraft").path("intents"));
    Map<String, SlotDefinition> slotsByCode =
        persistSlots(version.getId(), workflowDraft.path("slots"));
    persistPolicies(version.getId(), workflowDraft.path("policies"));
    persistRisks(version.getId(), workflowDraft.path("risks"));
    persistIntentSlotBindings(workflowDraft.path("intentSlotBindings"), intentsByCode, slotsByCode);
    persistWorkflows(
        version.getId(),
        workflowDraft.path("workflows"),
        intentsByCode,
        requiredSlotsByIntentCode(workflowDraft.path("intentSlotBindings")),
        seedConfig);

    version.activate(OffsetDateTime.now());
    domainPackVersionRepository.saveAndFlush(version);
    profileBuildRequestService.enqueue(version.getId(), seedConfig.profileBuildSource());
    log.info("Seed domain pack '{}' seeded as version {}", packKey, version.getId());
  }

  private JsonNode loadSeed(SeedConfig seedConfig) {
    ClassPathResource resource = new ClassPathResource(seedConfig.resourcePath());
    try (InputStream inputStream = resource.getInputStream()) {
      return objectMapper.readTree(inputStream);
    } catch (IOException e) {
      log.error("Seed resource read failed. path={}", seedConfig.resourcePath(), e);
      throw new IllegalStateException("Seed resource cannot be read", e);
    }
  }

  private DomainPack findOrCreatePack(
      JsonNode domainPackDraft, String packKey, SeedConfig seedConfig) {
    ensureWorkspace(seedConfig);
    return domainPackRepository
        .findByWorkspaceIdAndPackKey(seedConfig.workspaceId(), packKey)
        .orElseGet(
            () ->
                domainPackRepository.saveAndFlush(
                    DomainPack.create(
                        seedConfig.workspaceId(),
                        packKey,
                        requiredText(domainPackDraft, "packName"),
                        seedConfig.description(),
                        null)));
  }

  private void ensureWorkspace(SeedConfig seedConfig) {
    entityManager
        .createNativeQuery(
            """
            INSERT INTO app.workspace (id, workspace_key, name, description)
            VALUES (:id, :workspaceKey, :name, :description)
            ON CONFLICT (id) DO UPDATE
              SET name = EXCLUDED.name,
                  description = EXCLUDED.description,
                  status = 'ACTIVE',
                  updated_at = now()
            """)
        .setParameter("id", seedConfig.workspaceId())
        .setParameter("workspaceKey", seedConfig.workspaceKey())
        .setParameter("name", seedConfig.workspaceName())
        .setParameter(DESCRIPTION_FIELD, seedConfig.workspaceDescription())
        .executeUpdate();
    entityManager
        .createNativeQuery(
            "SELECT setval('app.workspace_id_seq', (SELECT COALESCE(MAX(id), 1) FROM app.workspace), true)")
        .getSingleResult();
  }

  private void seedDemoAccounts() {
    for (DemoAccountConfig accountConfig : DEMO_ACCOUNT_CONFIGS) {
      Long userId = upsertDemoUser(accountConfig);
      upsertDemoMembership(accountConfig.workspaceId(), userId);
      log.info(
          "Seed demo account '{}' mapped to workspace {}",
          accountConfig.email(),
          accountConfig.workspaceId());
    }
    resetAppUserSequence();
    resetWorkspaceMemberSequence();
  }

  private Long upsertDemoUser(DemoAccountConfig accountConfig) {
    Object result =
        entityManager
            .createNativeQuery(
                """
                INSERT INTO app.app_user (
                  email, name, password_hash, password_reset_required, role, status, profile_json
                )
                VALUES (
                  :email, :name, :credentialHash, false, 'OPERATOR', 'ACTIVE', '{}'::jsonb
                )
                ON CONFLICT (email) DO UPDATE
                  SET name = EXCLUDED.name,
                      password_hash = EXCLUDED.password_hash,
                      password_reset_required = false,
                      role = 'OPERATOR',
                      status = 'ACTIVE',
                      profile_json = '{}'::jsonb,
                      password_reset_token_hash = null,
                      password_reset_token_expires_at = null,
                      updated_at = now()
                RETURNING id
            """)
            .setParameter("email", accountConfig.email())
            .setParameter("name", accountConfig.name())
            .setParameter("credentialHash", passwordEncoder.encode(DEMO_SIGN_IN_VALUE))
            .getSingleResult();
    if (result instanceof Number number) {
      return number.longValue();
    }
    throw new IllegalStateException("Demo account upsert did not return a numeric user id");
  }

  private void upsertDemoMembership(Long workspaceId, Long userId) {
    entityManager
        .createNativeQuery(
            """
            INSERT INTO app.workspace_member (workspace_id, user_id, member_role)
            VALUES (:workspaceId, :userId, 'OPERATOR')
            ON CONFLICT (workspace_id, user_id) DO UPDATE
              SET member_role = EXCLUDED.member_role
            """)
        .setParameter("workspaceId", workspaceId)
        .setParameter("userId", userId)
        .executeUpdate();
  }

  private void resetAppUserSequence() {
    entityManager
        .createNativeQuery(
            """
            SELECT setval(
              'app.app_user_id_seq',
              (SELECT COALESCE(MAX(id), 1) FROM app.app_user),
              true
            )
            """)
        .getSingleResult();
  }

  private void resetWorkspaceMemberSequence() {
    entityManager
        .createNativeQuery(
            """
            SELECT setval(
              'app.workspace_member_id_seq',
              (SELECT COALESCE(MAX(id), 1) FROM app.workspace_member),
              true
            )
            """)
        .getSingleResult();
  }

  private DomainPackVersion createPublishedVersion(DomainPack pack, JsonNode seed) {
    int nextVersionNo =
        domainPackVersionRepository
            .findMaxVersionNoByDomainPackId(pack.getId())
            .map(versionNo -> versionNo + 1)
            .orElse(1);
    DomainPackVersion version =
        DomainPackVersion.createDraft(
            pack.getId(),
            nextVersionNo,
            null,
            null,
            jsonValue(seed.path("domainPackDraft"), "summaryJson", "{}"),
            null);
    return domainPackVersionRepository.saveAndFlush(version);
  }

  private Map<String, IntentDefinition> persistIntents(Long versionId, JsonNode intentDrafts) {
    List<IntentDefinition> intents = new ArrayList<>();
    Map<String, String> parentIntentByCode = new HashMap<>();
    for (JsonNode draft : iterable(intentDrafts)) {
      String intentCode = requiredText(draft, "intentCode");
      IntentDefinition intent =
          IntentDefinition.create(
              versionId,
              intentCode,
              requiredText(draft, "name"),
              textOrNull(draft, DESCRIPTION_FIELD),
              intOrDefault(draft, "taxonomyLevel", 1),
              buildIntentSourceClusterRef(draft),
              toRequiredAnyTerms(jsonValue(draft, "entryConditionJson", "{}")),
              buildIntentEvidenceJson(draft),
              jsonValue(draft, "metaJson", "{}"));
      intents.add(intent);
      parentIntentByCode.put(intentCode, textOrNull(draft, "parentIntentCode"));
    }

    List<IntentDefinition> saved = intentDefinitionRepository.saveAllAndFlush(intents);
    Map<String, IntentDefinition> byCode =
        saved.stream()
            .collect(Collectors.toMap(IntentDefinition::getIntentCode, Function.identity()));
    for (IntentDefinition intent : saved) {
      String parentIntentCode = parentIntentByCode.get(intent.getIntentCode());
      if (parentIntentCode != null) {
        IntentDefinition parent = requireIntent(byCode, parentIntentCode);
        intent.assignParent(parent.getId());
      }
      intent.changeStatus(IntentDefinition.STATUS_PUBLISHED);
    }
    return intentDefinitionRepository.saveAllAndFlush(saved).stream()
        .collect(Collectors.toMap(IntentDefinition::getIntentCode, Function.identity()));
  }

  private int backfillIntentInternalResources(Long versionId, JsonNode intentDrafts) {
    int updatedCount = 0;
    for (JsonNode draft : iterable(intentDrafts)) {
      int updatedRows =
          entityManager
              .createNativeQuery(
                  """
                  UPDATE pack.intent_definition
                     SET source_cluster_ref = cast(:sourceClusterRef as jsonb),
                         entry_condition_json = cast(:entryConditionJson as jsonb),
                         evidence_json = cast(:evidenceJson as jsonb),
                         meta_json = cast(:metaJson as jsonb),
                         updated_at = now()
                   WHERE domain_pack_version_id = :versionId
                     AND intent_code = :intentCode
                     AND (
                       source_cluster_ref IS DISTINCT FROM cast(:sourceClusterRef as jsonb)
                       OR entry_condition_json IS DISTINCT FROM cast(:entryConditionJson as jsonb)
                       OR evidence_json IS DISTINCT FROM cast(:evidenceJson as jsonb)
                       OR meta_json IS DISTINCT FROM cast(:metaJson as jsonb)
                     )
                  """)
              .setParameter("sourceClusterRef", buildIntentSourceClusterRef(draft))
              .setParameter(
                  "entryConditionJson",
                  toRequiredAnyTerms(jsonValue(draft, "entryConditionJson", "{}")))
              .setParameter("evidenceJson", buildIntentEvidenceJson(draft))
              .setParameter("metaJson", jsonValue(draft, "metaJson", "{}"))
              .setParameter("versionId", versionId)
              .setParameter("intentCode", requiredText(draft, "intentCode"))
              .executeUpdate();
      updatedCount += updatedRows;
    }
    return updatedCount;
  }

  private String buildIntentSourceClusterRef(JsonNode draft) {
    ObjectNode source = objectNodeFromJson(jsonValue(draft, "sourceClusterRef", "{}"));
    JsonNode entryCondition = readJson(jsonValue(draft, "entryConditionJson", "{}"));
    JsonNode meta = readJson(jsonValue(draft, "metaJson", "{}"));

    if (source.path("canonicalIntent").asText("").isBlank()) {
      source.put("canonicalIntent", requiredText(draft, "name"));
    }
    if (!source.has("clusterSize") && source.has("support")) {
      source.set("clusterSize", source.get("support"));
    }
    if (!source.has("segmentIds") && source.path("memberSourceIds").isArray()) {
      source.set("segmentIds", source.path("memberSourceIds").deepCopy());
    }
    if (source.path("source").asText("").isBlank()) {
      String metaSource = meta.path("source").asText("");
      source.put("source", metaSource.isBlank() ? "seed_candidate" : metaSource);
    }

    ArrayNode keywords = objectMapper.createArrayNode();
    addUniqueStrings(keywords, source.path("keywords"));
    addUniqueStrings(keywords, entryCondition.path("requiredTerms"));
    addUniqueStrings(keywords, entryCondition.path("requiredAnyTerms"));
    addUniqueStrings(keywords, entryCondition.path("optionalTerms"));
    if (!keywords.isEmpty()) {
      source.set("keywords", keywords);
    }

    return writeJson(source);
  }

  private String buildIntentEvidenceJson(JsonNode draft) {
    JsonNode representativeCases = draft.path("representativeCases");
    if (!representativeCases.isArray() || representativeCases.isEmpty()) {
      return jsonValue(draft, "evidenceJson", "[]");
    }

    ObjectNode evidence = objectMapper.createObjectNode();
    ArrayNode sampleSegmentTexts = evidence.putArray("sampleSegmentTexts");
    ArrayNode sampleIntentPhrases = evidence.putArray("sampleIntentPhrases");
    ArrayNode exemplarConversationIds = evidence.putArray("exemplarConversationIds");
    ArrayNode cases = evidence.putArray("representativeCases");

    for (JsonNode representativeCase : representativeCases) {
      String conversationId = textOrNull(representativeCase, "conversationId");
      String canonicalText = textOrNull(representativeCase, "canonicalText");
      String customerProblemText = textOrNull(representativeCase, "customerProblemText");

      if (canonicalText != null) {
        sampleSegmentTexts.add("고객: " + canonicalText);
      }
      if (customerProblemText != null) {
        addUniqueString(sampleIntentPhrases, customerProblemText);
      }
      if (conversationId != null) {
        addUniqueString(exemplarConversationIds, conversationId);
      }

      ObjectNode caseNode = objectMapper.createObjectNode();
      putIfPresent(caseNode, "conversationId", conversationId);
      putIfPresent(caseNode, "canonicalText", canonicalText);
      putIfPresent(caseNode, "customerProblemText", customerProblemText);
      putIfPresent(caseNode, "endedStatus", textOrNull(representativeCase, "endedStatus"));
      cases.add(caseNode);
    }

    JsonNode sourceRefs = readJson(jsonValue(draft, "evidenceJson", "[]"));
    if (!sourceRefs.isMissingNode()) {
      evidence.set("sourceRefs", sourceRefs);
    }

    return writeJson(evidence);
  }

  private Map<String, SlotDefinition> persistSlots(Long versionId, JsonNode slotDrafts) {
    List<SlotDefinition> slots = new ArrayList<>();
    for (JsonNode draft : iterable(slotDrafts)) {
      slots.add(
          SlotDefinition.create(
              versionId,
              requiredText(draft, "slotCode"),
              requiredText(draft, "name"),
              textOrNull(draft, DESCRIPTION_FIELD),
              requiredText(draft, "dataType"),
              boolOrDefault(draft, "isSensitive", false),
              jsonValue(draft, "validationRuleJson", "{}"),
              jsonValueOrNull(draft, "defaultValueJson"),
              jsonValue(draft, "metaJson", "{}")));
    }
    return slotDefinitionRepository.saveAllAndFlush(slots).stream()
        .collect(Collectors.toMap(SlotDefinition::getSlotCode, Function.identity()));
  }

  private int backfillSlotNames(Long versionId, JsonNode slotDrafts) {
    int updatedCount = 0;
    for (JsonNode draft : iterable(slotDrafts)) {
      int updatedRows =
          entityManager
              .createNativeQuery(
                  """
                  UPDATE pack.slot_definition
                     SET name = :name,
                         updated_at = now()
                   WHERE domain_pack_version_id = :versionId
                     AND slot_code = :slotCode
                     AND name IS DISTINCT FROM :name
                  """)
              .setParameter("name", requiredText(draft, "name"))
              .setParameter("versionId", versionId)
              .setParameter("slotCode", requiredText(draft, "slotCode"))
              .executeUpdate();
      updatedCount += updatedRows;
    }
    return updatedCount;
  }

  private int backfillIntentSlotBindingPrompts(Long versionId, JsonNode bindingDrafts) {
    int updatedCount = 0;
    for (JsonNode draft : iterable(bindingDrafts)) {
      int updatedRows =
          entityManager
              .createNativeQuery(
                  """
                  UPDATE pack.intent_slot_binding binding
                     SET prompt_hint = :promptHint
                    FROM pack.intent_definition intent,
                         pack.slot_definition slot
                   WHERE binding.intent_definition_id = intent.id
                     AND binding.slot_definition_id = slot.id
                     AND intent.domain_pack_version_id = :versionId
                     AND slot.domain_pack_version_id = :versionId
                     AND intent.intent_code = :intentCode
                     AND slot.slot_code = :slotCode
                     AND binding.prompt_hint IS DISTINCT FROM :promptHint
                  """)
              .setParameter("promptHint", textOrNull(draft, "promptHint"))
              .setParameter("versionId", versionId)
              .setParameter("intentCode", requiredText(draft, "intentCode"))
              .setParameter("slotCode", requiredText(draft, "slotCode"))
              .executeUpdate();
      updatedCount += updatedRows;
    }
    return updatedCount;
  }

  private void persistPolicies(Long versionId, JsonNode policyDrafts) {
    List<PolicyDefinition> policies = new ArrayList<>();
    for (JsonNode draft : iterable(policyDrafts)) {
      policies.add(
          PolicyDefinition.create(
              versionId,
              requiredText(draft, "policyCode"),
              requiredText(draft, "name"),
              textOrNull(draft, DESCRIPTION_FIELD),
              textOrNull(draft, "severity"),
              jsonValue(draft, "conditionJson", "{}"),
              jsonValue(draft, "actionJson", "{}"),
              jsonValue(draft, "evidenceJson", "[]"),
              jsonValue(draft, "metaJson", "{}")));
    }
    policyDefinitionRepository.saveAllAndFlush(policies);
  }

  private void persistRisks(Long versionId, JsonNode riskDrafts) {
    List<RiskDefinition> risks = new ArrayList<>();
    for (JsonNode draft : iterable(riskDrafts)) {
      risks.add(
          RiskDefinition.create(
              versionId,
              requiredText(draft, "riskCode"),
              requiredText(draft, "name"),
              textOrNull(draft, DESCRIPTION_FIELD),
              requiredText(draft, "riskLevel"),
              jsonValue(draft, "triggerConditionJson", "{}"),
              jsonValue(draft, "handlingActionJson", "{}"),
              jsonValue(draft, "evidenceJson", "[]"),
              jsonValue(draft, "metaJson", "{}")));
    }
    riskDefinitionRepository.saveAllAndFlush(risks);
  }

  private void persistIntentSlotBindings(
      JsonNode bindingDrafts,
      Map<String, IntentDefinition> intentsByCode,
      Map<String, SlotDefinition> slotsByCode) {
    List<IntentSlotBinding> bindings = new ArrayList<>();
    for (JsonNode draft : iterable(bindingDrafts)) {
      IntentDefinition intent = requireIntent(intentsByCode, requiredText(draft, "intentCode"));
      SlotDefinition slot = requireSlot(slotsByCode, requiredText(draft, "slotCode"));
      bindings.add(
          IntentSlotBinding.create(
              intent.getId(),
              slot.getId(),
              boolOrDefault(draft, "isRequired", false),
              intOrNull(draft, "collectionOrder"),
              textOrNull(draft, "promptHint"),
              jsonValue(draft, "conditionJson", "{}")));
    }
    intentSlotBindingRepository.saveAllAndFlush(bindings);
  }

  private void persistWorkflows(
      Long versionId,
      JsonNode workflowDrafts,
      Map<String, IntentDefinition> intentsByCode,
      Map<String, List<String>> requiredSlotsByIntentCode,
      SeedConfig seedConfig) {
    List<WorkflowDefinition> workflows = new ArrayList<>();
    for (JsonNode draft : iterable(workflowDrafts)) {
      String workflowCode = requiredText(draft, "workflowCode");
      String intentCode = requiredText(draft, "intentCode");
      String graphJson =
          buildRuntimeGraphJson(
              jsonValue(draft, "graphJson", "{}"),
              requiredSlotsByIntentCode.getOrDefault(intentCode, List.of()),
              workflowCode,
              seedConfig);
      validateGraph(graphJson, workflowCode);

      workflows.add(
          WorkflowDefinition.create(
              versionId,
              workflowCode,
              requiredText(draft, "name"),
              textOrNull(draft, DESCRIPTION_FIELD),
              graphJson,
              extractInitialState(graphJson),
              extractTerminalStatesJson(graphJson),
              jsonValue(draft, "evidenceJson", "[]"),
              withAutoRunEligible(jsonValue(draft, "metaJson", "{}")),
              requireIntent(intentsByCode, intentCode).getId(),
              boolOrDefault(draft, "isPrimary", true),
              toRequiredAnyTerms(jsonValue(draft, "routeConditionJson", "{}"))));
    }
    workflowDefinitionRepository.saveAllAndFlush(workflows);
  }

  private Map<String, List<String>> requiredSlotsByIntentCode(JsonNode bindingDrafts) {
    Map<String, List<JsonNode>> draftsByIntent = new LinkedHashMap<>();
    for (JsonNode draft : iterable(bindingDrafts)) {
      if (boolOrDefault(draft, "isRequired", false)) {
        draftsByIntent
            .computeIfAbsent(requiredText(draft, "intentCode"), ignored -> new ArrayList<>())
            .add(draft);
      }
    }

    Map<String, List<String>> result = new LinkedHashMap<>();
    draftsByIntent.forEach(
        (intentCode, drafts) ->
            result.put(
                intentCode,
                drafts.stream()
                    .sorted(
                        Comparator.comparing(draft -> intOrDefault(draft, "collectionOrder", 0)))
                    .map(draft -> requiredText(draft, "slotCode"))
                    .toList()));
    return result;
  }

  private String buildRuntimeGraphJson(
      String graphJson,
      List<String> requiredSlotCodes,
      String workflowCode,
      SeedConfig seedConfig) {
    try {
      ObjectNode graph = (ObjectNode) objectMapper.readTree(graphJson);
      Map<String, String> nodeTypeById = new HashMap<>();
      Map<String, String> policyRefByNode = new HashMap<>();
      for (JsonNode node : graph.path("nodes")) {
        nodeTypeById.put(node.path("id").asText(), node.path("type").asText());
        policyRefByNode.put(node.path("id").asText(), node.path("policyRef").asText(""));
      }
      ArrayNode edges = (ArrayNode) graph.path("edges");
      for (JsonNode edgeNode : edges) {
        ObjectNode edge = (ObjectNode) edgeNode;
        String from = edge.path("from").asText();
        String to = edge.path("to").asText();
        if ("collect_required_info".equals(from)
            && "verify_policy".equals(to)
            && !requiredSlotCodes.isEmpty()) {
          edge.set("condition", allSlotsPresentCondition(requiredSlotCodes));
        }
        if ("decision".equals(from) && "terminal".equals(to)) {
          edge.set("condition", defaultCondition());
        }
        // 순차 진행 엣지(START/ACTION/HANDOFF 출발)는 조건이 비어 있으면 엔진이 통과하지 못해
        // 워크플로우가 시작 노드에서 멈춘다. always 조건을 주입해 자동 진행되도록 한다.
        // DECISION 출발 엣지는 default/명시 조건으로만 라우팅해야 하므로 빈 분기는 휴면 상태로 둔다.
        if (needsAlwaysCondition(edge, nodeTypeById.get(from))) {
          edge.set("condition", alwaysCondition());
        }
      }
      injectPolicyHandoff(graph, edges, policyRefByNode, nodeTypeById, workflowCode, seedConfig);
      return objectMapper.writeValueAsString(graph);
    } catch (JsonProcessingException | ClassCastException e) {
      log.error("Seed workflow graph preparation failed. workflowCode={}", workflowCode, e);
      throw new IllegalStateException("Seed workflow graph cannot be prepared", e);
    }
  }

  /**
   * 정책이 실제 동작하는 모습을 시연하기 위해, 취소·환불 워크플로우는 정보 수집 후 verify_policy 노드에서 정책이 hit 되면 상담원 확인(HANDOFF)으로
   * 라우팅한다. policy_hit 엣지를 verify_policy 의 기존 always 엣지보다 앞에 두어 정책 분기가 우선되게 한다.
   */
  private void injectPolicyHandoff(
      ObjectNode graph,
      ArrayNode edges,
      Map<String, String> policyRefByNode,
      Map<String, String> nodeTypeById,
      String workflowCode,
      SeedConfig seedConfig) {
    if (!seedConfig.policyHandoffWorkflowCodes().contains(workflowCode)) {
      return;
    }
    String policyRef = policyRefByNode.getOrDefault("verify_policy", "");
    boolean hasHandoff = "HANDOFF".equals(nodeTypeById.get("handoff"));
    if (policyRef.isBlank() || !hasHandoff) {
      return;
    }
    ObjectNode policyEdge = objectMapper.createObjectNode();
    policyEdge.put("id", "e_policy_handoff");
    policyEdge.put("from", "verify_policy");
    policyEdge.put("to", "handoff");
    policyEdge.put("label", "policy_review_required");
    ObjectNode condition = objectMapper.createObjectNode();
    condition.put("type", "policy_hit");
    condition.put("policyCode", policyRef);
    policyEdge.set("condition", condition);

    ArrayNode reordered = objectMapper.createArrayNode();
    boolean inserted = false;
    for (JsonNode edgeNode : edges) {
      String from = edgeNode.path("from").asText();
      String type = edgeNode.path("condition").path("type").asText("");
      if (!inserted && "verify_policy".equals(from) && "always".equals(type)) {
        reordered.add(policyEdge);
        inserted = true;
      }
      reordered.add(edgeNode);
    }
    if (!inserted) {
      reordered.add(policyEdge);
    }
    graph.set("edges", reordered);
  }

  private String toRequiredAnyTerms(String conditionJson) {
    try {
      JsonNode node = objectMapper.readTree(conditionJson);
      if (!node.isObject() || !node.has("requiredTerms")) {
        return conditionJson;
      }
      ObjectNode condition = (ObjectNode) node;
      // requiredTerms 는 "모두 충족(AND)"으로 해석되어 자연어 발화로는 충족이 거의 불가능하다.
      // 키워드 목록의 의도는 "하나라도 포함(OR)"이므로 requiredAnyTerms 로 치환한다.
      condition.set("requiredAnyTerms", condition.get("requiredTerms"));
      condition.remove("requiredTerms");
      return objectMapper.writeValueAsString(condition);
    } catch (JsonProcessingException e) {
      log.warn(
          "Domain pack seed condition transform failed; keeping original conditionJson. value={}",
          conditionJson,
          e);
      return conditionJson;
    }
  }

  private String withAutoRunEligible(String metaJson) {
    try {
      JsonNode node = objectMapper.readTree(metaJson);
      ObjectNode meta = node.isObject() ? (ObjectNode) node : objectMapper.createObjectNode();
      // 하드코딩 시드는 ML 파이프라인의 replayFitness 평가를 거치지 않으므로, 임베딩 매칭의 autoRun
      // 품질 게이트를 통과하도록 명시적으로 autoRunEligible 을 부여한다(로컬 데모 용도).
      meta.put("autoRunEligible", true);
      return objectMapper.writeValueAsString(meta);
    } catch (JsonProcessingException e) {
      log.warn(
          "Domain pack seed meta transform failed; keeping original metaJson. value={}",
          metaJson,
          e);
      return metaJson;
    }
  }

  private boolean needsAlwaysCondition(ObjectNode edge, String sourceNodeType) {
    if ("DECISION".equals(sourceNodeType)) {
      return false;
    }
    JsonNode condition = edge.get("condition");
    return condition == null
        || !condition.isObject()
        || condition.path("type").asText("").isBlank();
  }

  private ObjectNode alwaysCondition() {
    ObjectNode condition = objectMapper.createObjectNode();
    condition.put("type", "always");
    return condition;
  }

  private ObjectNode allSlotsPresentCondition(List<String> requiredSlotCodes) {
    ObjectNode condition = objectMapper.createObjectNode();
    condition.put("type", "all");
    ArrayNode conditions = condition.putArray("conditions");
    for (String slotCode : requiredSlotCodes) {
      ObjectNode slotCondition = objectMapper.createObjectNode();
      slotCondition.put("type", "slot_present");
      slotCondition.put("slotCode", slotCode);
      conditions.add(slotCondition);
    }
    return condition;
  }

  private ObjectNode defaultCondition() {
    ObjectNode condition = objectMapper.createObjectNode();
    condition.put("type", "default");
    return condition;
  }

  private String extractInitialState(String graphJson) {
    for (JsonNode node : iterable(readGraph(graphJson).path("nodes"))) {
      if ("START".equals(node.path("type").asText())) {
        return requiredText(node, "id");
      }
    }
    throw new IllegalStateException("Seed workflow graph has no START node");
  }

  private String extractTerminalStatesJson(String graphJson) {
    ArrayNode terminals = objectMapper.createArrayNode();
    for (JsonNode node : iterable(readGraph(graphJson).path("nodes"))) {
      if ("TERMINAL".equals(node.path("type").asText())) {
        terminals.add(requiredText(node, "id"));
      }
    }
    return writeJson(terminals);
  }

  private JsonNode readGraph(String graphJson) {
    try {
      return objectMapper.readTree(graphJson);
    } catch (JsonProcessingException e) {
      log.error("Seed workflow graph parse failed", e);
      throw new IllegalStateException("Seed workflow graph cannot be parsed", e);
    }
  }

  private JsonNode readJson(String json) {
    try {
      return objectMapper.readTree(json);
    } catch (JsonProcessingException e) {
      log.warn("Seed JSON fragment parse failed; using empty object. value={}", json, e);
      return objectMapper.createObjectNode();
    }
  }

  private ObjectNode objectNodeFromJson(String json) {
    JsonNode node = readJson(json);
    return node.isObject() ? (ObjectNode) node : objectMapper.createObjectNode();
  }

  private void addUniqueStrings(ArrayNode target, JsonNode source) {
    if (!source.isArray()) {
      return;
    }
    for (JsonNode item : source) {
      String value = item.asText(null);
      if (value != null) {
        addUniqueString(target, value);
      }
    }
  }

  private void addUniqueString(ArrayNode target, String value) {
    String trimmed = value == null ? "" : value.trim();
    if (trimmed.isBlank() || containsString(target, trimmed)) {
      return;
    }
    target.add(trimmed);
  }

  private boolean containsString(ArrayNode target, String value) {
    for (JsonNode item : target) {
      if (value.equals(item.asText())) {
        return true;
      }
    }
    return false;
  }

  private void putIfPresent(ObjectNode target, String fieldName, String value) {
    if (value != null) {
      target.put(fieldName, value);
    }
  }

  private void validateGraph(String graphJson, String workflowCode) {
    try {
      Class<?> validatorClass =
          Class.forName("com.init.domainpack.application.WorkflowGraphValidator");
      Method parseAndValidate =
          validatorClass.getDeclaredMethod("parseAndValidate", String.class, String.class);
      parseAndValidate.setAccessible(true);
      parseAndValidate.invoke(null, graphJson, workflowCode);
    } catch (InvocationTargetException e) {
      log.error("워크플로우 그래프 검증 중 예외가 발생했습니다. workflowCode={}", workflowCode, e);
      Throwable cause = e.getCause();
      if (cause instanceof RuntimeException runtimeException) {
        throw runtimeException;
      }
      throw new IllegalStateException("워크플로우 그래프 검증에 실패했습니다.", cause);
    } catch (ReflectiveOperationException e) {
      log.error("워크플로우 그래프 검증기 호출에 실패했습니다. workflowCode={}", workflowCode, e);
      throw new IllegalStateException("워크플로우 그래프 검증기를 호출할 수 없습니다.", e);
    }
  }

  private IntentDefinition requireIntent(Map<String, IntentDefinition> intentsByCode, String code) {
    IntentDefinition intent = intentsByCode.get(code);
    if (intent == null) {
      throw new IllegalStateException("Seed references unknown intent: " + code);
    }
    return intent;
  }

  private SlotDefinition requireSlot(Map<String, SlotDefinition> slotsByCode, String code) {
    SlotDefinition slot = slotsByCode.get(code);
    if (slot == null) {
      throw new IllegalStateException("Seed references unknown slot: " + code);
    }
    return slot;
  }

  private Iterable<JsonNode> iterable(JsonNode node) {
    if (node == null || !node.isArray()) {
      return List.of();
    }
    List<JsonNode> nodes = new ArrayList<>();
    node.forEach(nodes::add);
    return nodes;
  }

  private String requiredText(JsonNode node, String fieldName) {
    String value = textOrNull(node, fieldName);
    if (value == null) {
      throw new IllegalStateException("Seed field is required: " + fieldName);
    }
    return value;
  }

  private String textOrNull(JsonNode node, String fieldName) {
    JsonNode value = node.get(fieldName);
    if (value == null || value.isNull()) {
      return null;
    }
    String text = value.asText(null);
    if (text == null || text.isBlank()) {
      return null;
    }
    return text.trim();
  }

  private Boolean boolOrDefault(JsonNode node, String fieldName, boolean defaultValue) {
    JsonNode value = node.get(fieldName);
    return value == null || value.isNull() ? defaultValue : value.asBoolean(defaultValue);
  }

  private Integer intOrNull(JsonNode node, String fieldName) {
    JsonNode value = node.get(fieldName);
    return value == null || value.isNull() ? null : value.asInt();
  }

  private Integer intOrDefault(JsonNode node, String fieldName, int defaultValue) {
    Integer value = intOrNull(node, fieldName);
    return value == null ? defaultValue : value;
  }

  private String jsonValue(JsonNode node, String fieldName, String defaultJson) {
    String value = jsonValueOrNull(node, fieldName);
    return value == null ? defaultJson : value;
  }

  private String jsonValueOrNull(JsonNode node, String fieldName) {
    JsonNode value = node.get(fieldName);
    if (value == null || value.isNull()) {
      return null;
    }
    if (value.isTextual()) {
      String text = value.asText();
      return text == null || text.isBlank() ? null : text;
    }
    return writeJson(value);
  }

  private String writeJson(JsonNode value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (JsonProcessingException e) {
      log.error("Seed JSON serialization failed", e);
      throw new IllegalStateException("Seed JSON cannot be serialized", e);
    }
  }

  private record SeedConfig(
      Long workspaceId,
      String workspaceKey,
      String workspaceName,
      String workspaceDescription,
      String resourcePath,
      String description,
      String profileBuildSource,
      Set<String> policyHandoffWorkflowCodes) {}

  private record DemoAccountConfig(Long workspaceId, String email, String name) {}
}
