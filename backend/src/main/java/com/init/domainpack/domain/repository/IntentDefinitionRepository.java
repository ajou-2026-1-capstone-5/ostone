package com.init.domainpack.domain.repository;

import com.init.domainpack.domain.model.IntentDefinition;
import java.util.List;
import java.util.Optional;

public interface IntentDefinitionRepository {

  <S extends IntentDefinition> List<S> saveAll(Iterable<S> entities);

  <S extends IntentDefinition> List<S> saveAllAndFlush(Iterable<S> entities);

  Optional<IntentDefinition> findById(Long id);

  IntentDefinition save(IntentDefinition intent);

  long countByDomainPackVersionId(Long domainPackVersionId);

  boolean existsByDomainPackVersionIdAndIntentCode(Long domainPackVersionId, String intentCode);

  Optional<IntentDefinition> findByDomainPackVersionIdAndIntentCode(
      Long domainPackVersionId, String intentCode);

  List<IntentDefinition> findByDomainPackVersionId(Long domainPackVersionId);

  Optional<IntentDefinition> findByIdAndDomainPackVersionId(Long id, Long domainPackVersionId);
}
