package com.init.domainpack.infrastructure.persistence;

import com.init.domainpack.domain.model.RiskDefinition;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
import com.init.shared.application.exception.NotFoundException;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaRiskDefinitionRepository
    extends JpaRepository<RiskDefinition, Long>, RiskDefinitionRepository {

  @Override
  default RiskDefinition findByIdOrThrow(Long id) {
    return findById(id)
        .orElseThrow(() -> new NotFoundException("NOT_FOUND", "위험요소를 찾을 수 없습니다: " + id));
  }

  List<RiskDefinition> findAllByDomainPackVersionIdOrderByRiskCodeAsc(Long domainPackVersionId);
}
