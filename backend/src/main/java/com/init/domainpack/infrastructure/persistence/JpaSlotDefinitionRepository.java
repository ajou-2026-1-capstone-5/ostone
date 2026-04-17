package com.init.domainpack.infrastructure.persistence;

import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaSlotDefinitionRepository
    extends JpaRepository<SlotDefinition, Long>, SlotDefinitionRepository {

  List<SlotDefinition> findByDomainPackVersionId(Long domainPackVersionId);

  @Query(
      "SELECT s FROM SlotDefinition s WHERE s.domainPackVersionId = :versionId ORDER BY s.slotCode ASC")
  List<SlotDefinition> findAllByDomainPackVersionIdOrderBySlotCodeAsc(
      @Param("versionId") Long versionId);

  Optional<SlotDefinition> findByIdAndDomainPackVersionId(Long id, Long domainPackVersionId);
}
