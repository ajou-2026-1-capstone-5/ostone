package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("데모 도메인 팩 목 JSON")
class DemoDomainPackMockTest {

  private static final String RESOURCE_PATH = "/mock/demo-domain-pack.json";
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final List<String> TOP_LEVEL_FIELDS =
      List.of("domainPack", "version", "intents", "slots", "policies", "risks", "workflows");
  private static final List<String> COLLECTION_FIELDS =
      List.of("intents", "slots", "policies", "risks", "workflows");
  private static final Map<String, String> CODE_FIELDS =
      Map.of(
          "intents", "intentCode",
          "slots", "slotCode",
          "policies", "policyCode",
          "risks", "riskCode",
          "workflows", "workflowCode");
  private static final Map<String, int[]> ID_RANGES =
      Map.of(
          "intents", new int[] {110, 119},
          "slots", new int[] {120, 129},
          "policies", new int[] {130, 139},
          "risks", new int[] {140, 149},
          "workflows", new int[] {150, 159});
  private static final Map<String, String> RISK_POLICY_CODES =
      Map.of(
          "high_value_cancel", "high_value_alert",
          "address_fraud", "address_change_limit",
          "refund_delay", "refund_amount_check");

  @Test
  @DisplayName("데모 도메인 팩 JSON을 파싱할 수 있다")
  void should_parseJsonSuccessfully() throws Exception {
    JsonNode root = loadRoot();

    assertThat(root).isNotNull();
    assertThat(root.isObject()).isTrue();
  }

  @Test
  @DisplayName("최상위 필드가 계약과 일치한다")
  void should_haveTopLevelFields() throws Exception {
    JsonNode root = loadRoot();

    assertThat(fieldNames(root)).containsExactlyInAnyOrderElementsOf(TOP_LEVEL_FIELDS);
    assertThat(root.path("domainPack").isObject()).isTrue();
    assertThat(root.path("version").isObject()).isTrue();
    COLLECTION_FIELDS.forEach(field -> assertThat(root.path(field).isArray()).isTrue());
  }

  @Test
  @DisplayName("엔티티 컬렉션이 비어 있지 않고 기대 개수와 일치한다")
  void should_haveNonEmptyCollections() throws Exception {
    JsonNode root = loadRoot();

    assertArraySize(root, "intents", 3);
    assertArraySize(root, "slots", 6);
    assertArraySize(root, "policies", 5);
    assertArraySize(root, "risks", 3);
    assertArraySize(root, "workflows", 3);
  }

  @Test
  @DisplayName("엔티티 ID가 타입별로 유일하고 타입 간에도 충돌하지 않는다")
  void should_haveUniqueIds() throws Exception {
    JsonNode root = loadRoot();
    List<Long> allIds = new ArrayList<>();

    COLLECTION_FIELDS.forEach(
        field -> {
          List<Long> ids = collectLongValues(root.path(field), "id");

          assertThat(ids).doesNotHaveDuplicates();
          allIds.addAll(ids);
        });

    assertThat(allIds).doesNotHaveDuplicates();
  }

  @Test
  @DisplayName("엔티티 코드가 타입별로 유일하다")
  void should_haveUniqueCodes() throws Exception {
    JsonNode root = loadRoot();

    CODE_FIELDS.forEach(
        (entityType, codeField) -> {
          List<String> codes = collectTextValues(root.path(entityType), codeField);

          assertThat(codes).doesNotHaveDuplicates();
        });
  }

  @Test
  @DisplayName("엔티티 간 참조가 존재하는 대상만 가리킨다")
  void should_haveValidCrossReferences() throws Exception {
    JsonNode root = loadRoot();
    Set<Long> slotIds = collectLongValuesAsSet(root.path("slots"), "id");
    Set<Long> workflowIds = collectLongValuesAsSet(root.path("workflows"), "id");
    Set<String> policyCodes = collectTextValuesAsSet(root.path("policies"), "policyCode");
    Set<Long> referencedSlotIds = new HashSet<>();
    Set<Long> referencedWorkflowIds = new HashSet<>();

    for (JsonNode intent : root.path("intents")) {
      Set<Long> requiredSlotIds = collectLongValuesAsSet(intent.path("requiredSlotIds"));
      Set<Long> intentWorkflowIds = collectLongValuesAsSet(intent.path("workflowIds"));

      assertThat(requiredSlotIds).isSubsetOf(slotIds);
      assertThat(intentWorkflowIds).isSubsetOf(workflowIds);
      referencedSlotIds.addAll(requiredSlotIds);
      referencedWorkflowIds.addAll(intentWorkflowIds);
    }

    // 모든 workflow는 적어도 하나의 intent에서 참조되어야 함
    assertThat(referencedWorkflowIds).containsAll(workflowIds);
    // 슬롯은 선택적일 수 있으므로 참조 무결성만 검증 (위 isSubsetOf에서 검증 완료)
    root.path("risks")
        .forEach(
            risk -> assertThat(policyCodes).contains(RISK_POLICY_CODES.get(risk.path("riskCode").asText())));
  }

  @Test
  @DisplayName("워크플로우 그래프 구조가 유효하다")
  void should_haveValidWorkflowGraphs() throws Exception {
    JsonNode root = loadRoot();
    Set<String> policyCodes = collectTextValuesAsSet(root.path("policies"), "policyCode");

    for (JsonNode workflow : root.path("workflows")) {
      assertWorkflowGraph(workflow, policyCodes);
    }
  }

  @Test
  @DisplayName("의도 상태는 폐기된 ACTIVE를 사용하지 않고 허용된 상태만 사용한다")
  void should_notUseForbiddenIntentStatus() throws Exception {
    JsonNode root = loadRoot();
    Set<String> allowedStatuses = Set.of("DRAFT", "PUBLISHED", "REJECTED");

    root.path("intents")
        .forEach(
            intent -> {
              String status = intent.path("status").asText();

              assertThat(status).isNotEqualTo("ACTIVE");
              assertThat(allowedStatuses).contains(status);
            });
  }

  @Test
  @DisplayName("버전이 같은 도메인 팩을 참조한다")
  void should_haveConsistentVersionReference() throws Exception {
    JsonNode root = loadRoot();

    assertThat(root.path("version").path("domainPackId").asLong())
        .isEqualTo(root.path("domainPack").path("id").asLong());
  }

  @Test
  @DisplayName("데모 데이터 ID는 결정적인 100번대 범위를 사용한다")
  void should_haveDeterministicIds() throws Exception {
    JsonNode root = loadRoot();
    List<Long> allIds = new ArrayList<>();

    assertThat(root.path("domainPack").path("id").asLong()).isEqualTo(100L);
    assertThat(root.path("version").path("id").asLong()).isEqualTo(101L);
    allIds.add(root.path("domainPack").path("id").asLong());
    allIds.add(root.path("version").path("id").asLong());
    ID_RANGES.forEach(
        (field, range) ->
            collectLongValues(root.path(field), "id")
                .forEach(id -> assertThat(id).isBetween((long) range[0], (long) range[1])));
    COLLECTION_FIELDS.forEach(field -> allIds.addAll(collectLongValues(root.path(field), "id")));

    assertThat(allIds).allSatisfy(id -> assertThat(id).isBetween(100L, 199L));
  }

  private static JsonNode loadRoot() throws Exception {
    try (InputStream inputStream = DemoDomainPackMockTest.class.getResourceAsStream(RESOURCE_PATH)) {
      assertThat(inputStream).isNotNull();
      return OBJECT_MAPPER.readTree(inputStream);
    }
  }

  private static void assertArraySize(JsonNode root, String field, int expectedSize) {
    JsonNode array = root.path(field);

    assertThat(array.isArray()).isTrue();
    assertThat(array).hasSizeGreaterThan(0).hasSize(expectedSize);
  }

  private static void assertWorkflowGraph(JsonNode workflow, Set<String> policyCodes) {
    JsonNode graphJson = workflow.path("graphJson");
    JsonNode nodes = graphJson.path("nodes");
    JsonNode edges = graphJson.path("edges");
    List<String> terminalNodeIds = collectNodeIdsByType(nodes, "TERMINAL");
    List<String> startNodeIds = collectNodeIdsByType(nodes, "START");
    Set<String> nodeIds = collectTextValuesAsSet(nodes, "id");

    assertThat(nodes.isArray()).isTrue();
    assertThat(edges.isArray()).isTrue();
    assertThat(startNodeIds).hasSize(1);
    assertThat(terminalNodeIds).isNotEmpty();
    assertThat(collectTextValues(nodes, "id")).doesNotHaveDuplicates();
    assertThat(collectTextValues(edges, "id")).doesNotHaveDuplicates();
    assertEdgesReferenceExistingNodes(edges, nodeIds);
    assertTerminalNodesHaveNoOutgoingEdges(edges, terminalNodeIds);
    assertDecisionNodesHaveValidOutgoingEdges(nodes, edges);
    assertActionPolicyRefsAreValid(nodes, policyCodes);
    assertThat(reachableNodeIds(startNodeIds.get(0), edges)).containsAll(nodeIds);
  }

  private static void assertEdgesReferenceExistingNodes(JsonNode edges, Set<String> nodeIds) {
    edges.forEach(
        edge -> {
          assertThat(nodeIds).contains(edge.path("from").asText());
          assertThat(nodeIds).contains(edge.path("to").asText());
        });
  }

  private static void assertTerminalNodesHaveNoOutgoingEdges(JsonNode edges, List<String> terminalNodeIds) {
    edges.forEach(edge -> assertThat(terminalNodeIds).doesNotContain(edge.path("from").asText()));
  }

  private static void assertDecisionNodesHaveValidOutgoingEdges(JsonNode nodes, JsonNode edges) {
    collectNodeIdsByType(nodes, "DECISION")
        .forEach(
            decisionNodeId -> {
              List<JsonNode> outgoingEdges = outgoingEdges(edges, decisionNodeId);

              assertThat(outgoingEdges).hasSizeGreaterThanOrEqualTo(2);
              outgoingEdges.forEach(edge -> assertThat(edge.path("label").asText()).isNotBlank());
            });
  }

  private static void assertActionPolicyRefsAreValid(JsonNode nodes, Set<String> policyCodes) {
    stream(nodes)
        .filter(node -> "ACTION".equals(node.path("type").asText()))
        .filter(node -> node.hasNonNull("policyRef"))
        .forEach(node -> assertThat(policyCodes).contains(node.path("policyRef").asText()));
  }

  private static Set<String> reachableNodeIds(String startNodeId, JsonNode edges) {
    Map<String, List<String>> nextNodeIdsByNodeId = new HashMap<>();
    edges.forEach(
        edge ->
            nextNodeIdsByNodeId
                .computeIfAbsent(edge.path("from").asText(), ignored -> new ArrayList<>())
                .add(edge.path("to").asText()));

    Set<String> visited = new HashSet<>();
    ArrayDeque<String> queue = new ArrayDeque<>();
    queue.add(startNodeId);
    while (!queue.isEmpty()) {
      String nodeId = queue.removeFirst();
      if (!visited.add(nodeId)) {
        continue;
      }
      nextNodeIdsByNodeId.getOrDefault(nodeId, List.of()).forEach(queue::addLast);
    }
    return visited;
  }

  private static List<JsonNode> outgoingEdges(JsonNode edges, String nodeId) {
    return stream(edges).filter(edge -> nodeId.equals(edge.path("from").asText())).toList();
  }

  private static List<String> collectNodeIdsByType(JsonNode nodes, String type) {
    return stream(nodes)
        .filter(node -> type.equals(node.path("type").asText()))
        .map(node -> node.path("id").asText())
        .toList();
  }

  private static List<Long> collectLongValues(JsonNode array, String field) {
    return stream(array).map(node -> node.path(field).asLong()).toList();
  }

  private static Set<Long> collectLongValuesAsSet(JsonNode array, String field) {
    return new HashSet<>(collectLongValues(array, field));
  }

  private static Set<Long> collectLongValuesAsSet(JsonNode array) {
    return stream(array).map(JsonNode::asLong).collect(Collectors.toSet());
  }

  private static List<String> collectTextValues(JsonNode array, String field) {
    return stream(array).map(node -> node.path(field).asText()).toList();
  }

  private static Set<String> collectTextValuesAsSet(JsonNode array, String field) {
    return new HashSet<>(collectTextValues(array, field));
  }

  private static List<String> fieldNames(JsonNode node) {
    return stream(node.fieldNames()).toList();
  }

  private static <T> java.util.stream.Stream<T> stream(Iterator<T> iterator) {
    return StreamSupport.stream(((Iterable<T>) () -> iterator).spliterator(), false);
  }

  private static <T> java.util.stream.Stream<T> stream(Iterable<T> iterable) {
    return StreamSupport.stream(iterable.spliterator(), false);
  }
}
