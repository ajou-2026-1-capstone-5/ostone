package com.init.domainpack.infrastructure.persistence;

import com.init.domainpack.domain.model.RiskDefinition;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaRiskDefinitionRepository extends JpaRepository<RiskDefinition, Long> {

  List<RiskDefinition> findByDomainPackVersionId(Long domainPackVersionId);
}
