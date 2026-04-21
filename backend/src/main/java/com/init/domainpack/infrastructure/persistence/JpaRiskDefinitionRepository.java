package com.init.domainpack.infrastructure.persistence;

import com.init.domainpack.domain.model.RiskDefinition;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaRiskDefinitionRepository
    extends JpaRepository<RiskDefinition, Long>, RiskDefinitionRepository {

  List<RiskDefinition> findAllByDomainPackVersionIdOrderByRiskCodeAsc(Long domainPackVersionId);
}
