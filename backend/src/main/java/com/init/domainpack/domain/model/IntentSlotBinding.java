package com.init.domainpack.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.Objects;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "intent_slot_binding", schema = "pack")
public class IntentSlotBinding {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "intent_definition_id", nullable = false)
  private Long intentDefinitionId;

  @Column(name = "slot_definition_id", nullable = false)
  private Long slotDefinitionId;

  @Column(name = "is_required", nullable = false)
  private Boolean isRequired;

  @Column(name = "collection_order")
  private Integer collectionOrder;

  @Column(name = "prompt_hint")
  private String promptHint;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "condition_json", columnDefinition = "jsonb", nullable = false)
  private String conditionJson;

  protected IntentSlotBinding() {}

  public static IntentSlotBinding create(
      Long intentDefinitionId,
      Long slotDefinitionId,
      Boolean isRequired,
      Integer collectionOrder,
      String promptHint,
      String conditionJson) {
    Objects.requireNonNull(intentDefinitionId, "intentDefinitionId must not be null");
    Objects.requireNonNull(slotDefinitionId, "slotDefinitionId must not be null");

    IntentSlotBinding entity = new IntentSlotBinding();
    entity.intentDefinitionId = intentDefinitionId;
    entity.slotDefinitionId = slotDefinitionId;
    entity.isRequired = isRequired != null ? isRequired : false;
    entity.collectionOrder = collectionOrder;
    entity.promptHint = promptHint;
    entity.conditionJson = conditionJson != null ? conditionJson : "{}";
    return entity;
  }

  public Long getId() {
    return id;
  }

  public Long getIntentDefinitionId() {
    return intentDefinitionId;
  }

  public Long getSlotDefinitionId() {
    return slotDefinitionId;
  }

  public Boolean getIsRequired() {
    return isRequired;
  }

  public Integer getCollectionOrder() {
    return collectionOrder;
  }

  public String getPromptHint() {
    return promptHint;
  }

  public String getConditionJson() {
    return conditionJson;
  }
}
