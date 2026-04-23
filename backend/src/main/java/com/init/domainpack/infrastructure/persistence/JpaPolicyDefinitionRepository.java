package com.init.domainpack.infrastructure.persistence;

import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaPolicyDefinitionRepository
    extends JpaRepository<PolicyDefinition, Long>, PolicyDefinitionRepository {

  List<PolicyDefinition> findAllByDomainPackVersionIdOrderByPolicyCodeAsc(Long domainPackVersionId);

  Optional<PolicyDefinition> findByIdAndDomainPackVersionId(Long id, Long domainPackVersionId);

  @Query(
      "SELECT p.policyCode FROM PolicyDefinition p"
          + " WHERE p.domainPackVersionId = :versionId AND p.policyCode IN :policyCodes")
  Set<String> findExistingPolicyCodesByVersionIdAndCodes(
      @Param("versionId") Long versionId, @Param("policyCodes") Set<String> policyCodes);
}
