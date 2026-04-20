package com.init.domainpack.infrastructure.persistence;

import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaSlotDefinitionRepository
    extends JpaRepository<SlotDefinition, Long>, SlotDefinitionRepository {

  List<SlotDefinition> findAllByDomainPackVersionIdOrderBySlotCodeAsc(Long domainPackVersionId);

  Optional<SlotDefinition> findByIdAndDomainPackVersionId(Long id, Long domainPackVersionId);
}
