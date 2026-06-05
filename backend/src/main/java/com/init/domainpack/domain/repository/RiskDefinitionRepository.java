package com.init.domainpack.domain.repository;

import com.init.domainpack.domain.model.RiskDefinition;
import java.util.List;
import java.util.Optional;

public interface RiskDefinitionRepository {

  <S extends RiskDefinition> List<S> saveAll(Iterable<S> entities);

  <S extends RiskDefinition> List<S> saveAllAndFlush(Iterable<S> entities);

  RiskDefinition findByIdOrThrow(Long id);

  long countByDomainPackVersionId(Long domainPackVersionId);

  Optional<RiskDefinition> findByIdAndDomainPackVersionId(Long id, Long domainPackVersionId);

  Optional<RiskDefinition> findByDomainPackVersionIdAndRiskCode(
      Long domainPackVersionId, String riskCode);

  List<RiskDefinition> findAllByDomainPackVersionIdOrderByRiskCodeAsc(Long domainPackVersionId);

  RiskDefinition save(RiskDefinition risk);
}
