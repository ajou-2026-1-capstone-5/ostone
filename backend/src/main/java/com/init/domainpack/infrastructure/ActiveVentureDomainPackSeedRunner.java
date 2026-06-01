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
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile({"local", "dev"})
@Order(Ordered.LOWEST_PRECEDENCE - 90)
public class ActiveVentureDomainPackSeedRunner implements ApplicationRunner {

  private static final Logger log =
      LoggerFactory.getLogger(ActiveVentureDomainPackSeedRunner.class);
  private static final Long WORKSPACE_ID = 1L;
  private static final String RESOURCE_PATH = "seed/activeventure-workflow-candidate.json";

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
      ObjectMapper objectMapper) {
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
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    JsonNode seed = loadSeed();
    String packKey = requiredText(seed.path("domainPackDraft"), "packKey");
    DomainPack pack = findOrCreatePack(seed.path("domainPackDraft"), packKey);
    if (domainPackVersionRepository.findCurrentPublishedByDomainPackId(pack.getId()).isPresent()) {
      log.info("ActiveVenture domain pack '{}' already has a published version, skipping", packKey);
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
        requiredSlotsByIntentCode(workflowDraft.path("intentSlotBindings")));

    version.activate(OffsetDateTime.now());
    domainPackVersionRepository.saveAndFlush(version);
    profileBuildRequestService.enqueue(version.getId(), "ACTIVEVENTURE_SEED");
    log.info("ActiveVenture domain pack '{}' seeded as version {}", packKey, version.getId());
  }

  private JsonNode loadSeed() {
    ClassPathResource resource = new ClassPathResource(RESOURCE_PATH);
    try (InputStream inputStream = resource.getInputStream()) {
      return objectMapper.readTree(inputStream);
    } catch (IOException e) {
      log.error("ActiveVenture seed resource read failed. path={}", RESOURCE_PATH, e);
      throw new IllegalStateException("ActiveVenture seed resource cannot be read", e);
    }
  }

  private DomainPack findOrCreatePack(JsonNode domainPackDraft, String packKey) {
    ensureWorkspace();
    return domainPackRepository
        .findByWorkspaceIdAndPackKey(WORKSPACE_ID, packKey)
        .orElseGet(
            () ->
                domainPackRepository.saveAndFlush(
                    DomainPack.create(
                        WORKSPACE_ID,
                        packKey,
                        requiredText(domainPackDraft, "packName"),
                        "activeventure_100 상담 로그에서 생성한 여행 상담 도메인팩",
                        null)));
  }

  private void ensureWorkspace() {
    entityManager
        .createNativeQuery(
            """
            INSERT INTO app.workspace (id, workspace_key, name, description)
            VALUES (1, 'WS-DEMO', 'Demo Workspace', 'Demo workspace for consultation')
            ON CONFLICT (id) DO NOTHING
            """)
        .executeUpdate();
    entityManager
        .createNativeQuery(
            "SELECT setval('app.workspace_id_seq', (SELECT COALESCE(MAX(id), 1) FROM app.workspace), true)")
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
              textOrNull(draft, "description"),
              intOrDefault(draft, "taxonomyLevel", 1),
              jsonValue(draft, "sourceClusterRef", "{}"),
              toRequiredAnyTerms(jsonValue(draft, "entryConditionJson", "{}")),
              jsonValue(draft, "evidenceJson", "[]"),
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

  private Map<String, SlotDefinition> persistSlots(Long versionId, JsonNode slotDrafts) {
    List<SlotDefinition> slots = new ArrayList<>();
    for (JsonNode draft : iterable(slotDrafts)) {
      slots.add(
          SlotDefinition.create(
              versionId,
              requiredText(draft, "slotCode"),
              requiredText(draft, "name"),
              textOrNull(draft, "description"),
              requiredText(draft, "dataType"),
              boolOrDefault(draft, "isSensitive", false),
              jsonValue(draft, "validationRuleJson", "{}"),
              jsonValueOrNull(draft, "defaultValueJson"),
              jsonValue(draft, "metaJson", "{}")));
    }
    return slotDefinitionRepository.saveAllAndFlush(slots).stream()
        .collect(Collectors.toMap(SlotDefinition::getSlotCode, Function.identity()));
  }

  private void persistPolicies(Long versionId, JsonNode policyDrafts) {
    List<PolicyDefinition> policies = new ArrayList<>();
    for (JsonNode draft : iterable(policyDrafts)) {
      policies.add(
          PolicyDefinition.create(
              versionId,
              requiredText(draft, "policyCode"),
              requiredText(draft, "name"),
              textOrNull(draft, "description"),
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
              textOrNull(draft, "description"),
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
      Map<String, List<String>> requiredSlotsByIntentCode) {
    List<WorkflowDefinition> workflows = new ArrayList<>();
    for (JsonNode draft : iterable(workflowDrafts)) {
      String workflowCode = requiredText(draft, "workflowCode");
      String intentCode = requiredText(draft, "intentCode");
      String graphJson =
          buildRuntimeGraphJson(
              jsonValue(draft, "graphJson", "{}"),
              requiredSlotsByIntentCode.getOrDefault(intentCode, List.of()),
              workflowCode);
      validateGraph(graphJson, workflowCode);

      workflows.add(
          WorkflowDefinition.create(
              versionId,
              workflowCode,
              requiredText(draft, "name"),
              textOrNull(draft, "description"),
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
      String graphJson, List<String> requiredSlotCodes, String workflowCode) {
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
      injectPolicyHandoff(graph, edges, policyRefByNode, nodeTypeById, workflowCode);
      return objectMapper.writeValueAsString(graph);
    } catch (JsonProcessingException | ClassCastException e) {
      log.error(
          "ActiveVenture workflow graph preparation failed. workflowCode={}", workflowCode, e);
      throw new IllegalStateException("ActiveVenture workflow graph cannot be prepared", e);
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
      String workflowCode) {
    if (!"cancellation_refund_change_policy_flow".equals(workflowCode)) {
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
          "ActiveVenture seed condition transform failed; keeping original conditionJson. value={}",
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
          "ActiveVenture seed meta transform failed; keeping original metaJson. value={}",
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
    throw new IllegalStateException("ActiveVenture workflow graph has no START node");
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
      log.error("ActiveVenture workflow graph parse failed", e);
      throw new IllegalStateException("ActiveVenture workflow graph cannot be parsed", e);
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
      throw new IllegalStateException("ActiveVenture seed references unknown intent: " + code);
    }
    return intent;
  }

  private SlotDefinition requireSlot(Map<String, SlotDefinition> slotsByCode, String code) {
    SlotDefinition slot = slotsByCode.get(code);
    if (slot == null) {
      throw new IllegalStateException("ActiveVenture seed references unknown slot: " + code);
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
      throw new IllegalStateException("ActiveVenture seed field is required: " + fieldName);
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
      log.error("ActiveVenture seed JSON serialization failed", e);
      throw new IllegalStateException("ActiveVenture seed JSON cannot be serialized", e);
    }
  }
}
