package com.init.domainpack.infrastructure.persistence;

import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaPolicyDefinitionRepository
    extends JpaRepository<PolicyDefinition, Long>, PolicyDefinitionRepository {

  List<PolicyDefinition> findAllByDomainPackVersionIdOrderByPolicyCodeAsc(Long domainPackVersionId);

  Optional<PolicyDefinition> findByIdAndDomainPackVersionId(Long id, Long domainPackVersionId);
}
