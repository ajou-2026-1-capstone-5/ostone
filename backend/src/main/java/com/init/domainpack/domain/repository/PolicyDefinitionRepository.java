package com.init.domainpack.domain.repository;

import com.init.domainpack.domain.model.PolicyDefinition;
import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface PolicyDefinitionRepository {

  <S extends PolicyDefinition> List<S> saveAll(Iterable<S> entities);

  Optional<PolicyDefinition> findById(Long id);

  Optional<PolicyDefinition> findByIdAndDomainPackVersionId(Long id, Long domainPackVersionId);

  List<PolicyDefinition> findAllByDomainPackVersionIdOrderByPolicyCodeAsc(Long domainPackVersionId);

  PolicyDefinition save(PolicyDefinition policy);

  Set<String> findExistingPolicyCodesByVersionIdAndCodes(Long versionId, Set<String> policyCodes);
}
