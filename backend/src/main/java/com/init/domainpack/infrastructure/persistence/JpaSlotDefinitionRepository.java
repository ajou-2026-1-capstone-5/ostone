package com.init.domainpack.infrastructure.persistence;

import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.shared.application.exception.NotFoundException;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaSlotDefinitionRepository
    extends JpaRepository<SlotDefinition, Long>, SlotDefinitionRepository {

  @Override
  default SlotDefinition findByIdOrThrow(Long id) {
    return findById(id)
        .orElseThrow(() -> new NotFoundException("NOT_FOUND", "슬롯을 찾을 수 없습니다: " + id));
  }

  List<SlotDefinition> findAllByDomainPackVersionIdOrderBySlotCodeAsc(Long domainPackVersionId);

  Optional<SlotDefinition> findByIdAndDomainPackVersionId(Long id, Long domainPackVersionId);
}
