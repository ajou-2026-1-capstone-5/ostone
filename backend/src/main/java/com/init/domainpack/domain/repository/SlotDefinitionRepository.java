package com.init.domainpack.domain.repository;

import com.init.domainpack.domain.model.SlotDefinition;
import java.util.List;
import java.util.Optional;

public interface SlotDefinitionRepository {

  <S extends SlotDefinition> List<S> saveAll(Iterable<S> entities);

  SlotDefinition findByIdOrThrow(Long id);

  SlotDefinition save(SlotDefinition slot);

  long countByDomainPackVersionId(Long domainPackVersionId);

  List<SlotDefinition> findAllByDomainPackVersionIdOrderBySlotCodeAsc(Long domainPackVersionId);

  Optional<SlotDefinition> findByIdAndDomainPackVersionId(Long id, Long domainPackVersionId);
}
