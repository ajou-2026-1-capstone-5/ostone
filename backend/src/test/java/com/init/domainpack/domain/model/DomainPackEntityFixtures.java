package com.init.domainpack.domain.model;

import java.lang.reflect.Field;
import java.time.OffsetDateTime;

public final class DomainPackEntityFixtures {

  public static final OffsetDateTime DEFAULT_CREATED_AT =
      OffsetDateTime.parse("2026-04-10T10:00:00Z");
  public static final OffsetDateTime DEFAULT_UPDATED_AT =
      OffsetDateTime.parse("2026-04-10T10:00:00Z");

  private DomainPackEntityFixtures() {
    throw new AssertionError("No instances");
  }

  public static DomainPackVersion version(Long id, Long packId, String status) {
    return version(id, packId, 1, status, null, "{}", null, null, null, DEFAULT_UPDATED_AT);
  }

  public static DomainPackVersion version(
      Long id, Long packId, Integer versionNo, String status, String summaryJson) {
    return version(
        id, packId, versionNo, status, null, summaryJson, null, null, null, DEFAULT_UPDATED_AT);
  }

  public static DomainPackVersion version(
      Long id,
      Long packId,
      Integer versionNo,
      String status,
      Long sourcePipelineJobId,
      String summaryJson,
      String description,
      OffsetDateTime publishedAt,
      OffsetDateTime createdAt,
      OffsetDateTime updatedAt) {
    DomainPackVersion version = DomainPackVersion.ofForTest(id, packId, status);
    assignFields(
        version,
        "versionNo",
        versionNo,
        "sourcePipelineJobId",
        sourcePipelineJobId,
        "summaryJson",
        summaryJson != null ? summaryJson : "{}",
        "description",
        description,
        "publishedAt",
        publishedAt);
    assignPersistenceMetadata(version, id, createdAt, updatedAt);
    return version;
  }

  public static DomainPackVersion withVersionMetadata(
      DomainPackVersion version,
      Integer versionNo,
      Long sourcePipelineJobId,
      String summaryJson,
      String description,
      OffsetDateTime publishedAt,
      OffsetDateTime updatedAt) {
    assignFields(
        version,
        "versionNo",
        versionNo != null ? versionNo : version.getVersionNo(),
        "sourcePipelineJobId",
        sourcePipelineJobId != null ? sourcePipelineJobId : version.getSourcePipelineJobId(),
        "summaryJson",
        summaryJson != null ? summaryJson : version.getSummaryJson(),
        "description",
        description != null ? description : version.getDescription(),
        "publishedAt",
        publishedAt != null ? publishedAt : version.getPublishedAt(),
        "updatedAt",
        updatedAt != null ? updatedAt : version.getUpdatedAt());
    return version;
  }

  public static DomainPack persisted(DomainPack pack, Long id) {
    assignPersistenceMetadata(pack, id, DEFAULT_CREATED_AT, DEFAULT_UPDATED_AT);
    return pack;
  }

  public static IntentDefinition persisted(IntentDefinition intent, Long id) {
    return persisted(intent, id, intent.getStatus(), intent.getParentIntentId());
  }

  public static IntentDefinition persisted(
      IntentDefinition intent, Long id, String status, Long parentIntentId) {
    assignFields(intent, "status", status, "parentIntentId", parentIntentId);
    assignPersistenceMetadata(intent, id, DEFAULT_CREATED_AT, DEFAULT_UPDATED_AT);
    return intent;
  }

  public static SlotDefinition persisted(SlotDefinition slot, Long id) {
    assignPersistenceMetadata(slot, id, DEFAULT_CREATED_AT, DEFAULT_UPDATED_AT);
    return slot;
  }

  public static PolicyDefinition persisted(PolicyDefinition policy, Long id) {
    assignPersistenceMetadata(policy, id, DEFAULT_CREATED_AT, DEFAULT_UPDATED_AT);
    return policy;
  }

  public static RiskDefinition persisted(RiskDefinition risk, Long id) {
    assignPersistenceMetadata(risk, id, DEFAULT_CREATED_AT, DEFAULT_UPDATED_AT);
    return risk;
  }

  public static WorkflowDefinition persisted(WorkflowDefinition workflow, Long id) {
    assignPersistenceMetadata(workflow, id, DEFAULT_CREATED_AT, DEFAULT_UPDATED_AT);
    return workflow;
  }

  public static WorkflowDefinition persisted(
      WorkflowDefinition workflow, Long id, OffsetDateTime createdAt, OffsetDateTime updatedAt) {
    assignPersistenceMetadata(workflow, id, createdAt, updatedAt);
    return workflow;
  }

  public static IntentSlotBinding persisted(IntentSlotBinding binding, Long id) {
    assignField(binding, "id", id);
    return binding;
  }

  public static Object persisted(Object entity, Long id) {
    if (entity instanceof IntentDefinition intent) {
      return persisted(intent, id);
    }
    if (entity instanceof SlotDefinition slot) {
      return persisted(slot, id);
    }
    if (entity instanceof PolicyDefinition policy) {
      return persisted(policy, id);
    }
    if (entity instanceof RiskDefinition risk) {
      return persisted(risk, id);
    }
    if (entity instanceof WorkflowDefinition workflow) {
      return persisted(workflow, id);
    }
    if (entity instanceof IntentSlotBinding binding) {
      return persisted(binding, id);
    }
    if (entity instanceof DomainPackVersion version) {
      assignField(version, "id", id);
      return version;
    }
    if (entity instanceof DomainPack pack) {
      return persisted(pack, id);
    }
    return entity;
  }

  private static void assignPersistenceMetadata(
      Object entity, Long id, OffsetDateTime createdAt, OffsetDateTime updatedAt) {
    assignFields(entity, "id", id, "createdAt", createdAt, "updatedAt", updatedAt);
  }

  private static void assignFields(Object entity, Object... namesAndValues) {
    if (namesAndValues.length % 2 != 0) {
      throw new IllegalArgumentException("namesAndValues must contain field/value pairs");
    }
    for (int i = 0; i < namesAndValues.length; i += 2) {
      assignField(entity, (String) namesAndValues[i], namesAndValues[i + 1]);
    }
  }

  @SuppressWarnings("java:S3011")
  private static void assignField(Object entity, String fieldName, Object value) {
    Field field = findField(entity.getClass(), fieldName);
    try {
      field.setAccessible(true);
      field.set(entity, value);
    } catch (IllegalAccessException ex) {
      throw new IllegalStateException("Failed to assign " + fieldName, ex);
    }
  }

  private static Field findField(Class<?> type, String fieldName) {
    Class<?> current = type;
    while (current != null) {
      try {
        return current.getDeclaredField(fieldName);
      } catch (NoSuchFieldException ex) {
        current = current.getSuperclass();
      }
    }
    throw new IllegalArgumentException("Field not found: " + fieldName);
  }
}
