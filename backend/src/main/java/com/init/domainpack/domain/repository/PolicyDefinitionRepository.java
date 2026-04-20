package com.init.domainpack.domain.repository;

import com.init.domainpack.domain.model.PolicyDefinition;
import java.util.List;
import java.util.Optional;

public interface PolicyDefinitionRepository {

  <S extends PolicyDefinition> List<S> saveAll(Iterable<S> entities);

  Optional<PolicyDefinition> findById(Long id);

  Optional<PolicyDefinition> findByIdAndDomainPackVersionId(Long id, Long domainPackVersionId);

  PolicyDefinition save(PolicyDefinition policy);
}
