package com.init.domainpack.infrastructure.persistence;

import com.init.domainpack.domain.model.PolicyDefinition;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaPolicyDefinitionRepository extends JpaRepository<PolicyDefinition, Long> {

  List<PolicyDefinition> findByDomainPackVersionId(Long domainPackVersionId);
}
