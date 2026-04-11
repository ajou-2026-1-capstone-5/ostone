package com.init.domainpack.infrastructure.persistence;

import com.init.domainpack.domain.model.SlotDefinition;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaSlotDefinitionRepository extends JpaRepository<SlotDefinition, Long> {

  List<SlotDefinition> findByDomainPackVersionId(Long domainPackVersionId);
}
