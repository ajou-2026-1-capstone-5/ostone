package com.init.domainpack.domain.repository;

import com.init.domainpack.domain.model.RiskDefinition;
import java.util.List;
import java.util.Optional;

public interface RiskDefinitionRepository {

  <S extends RiskDefinition> List<S> saveAll(Iterable<S> entities);

  Optional<RiskDefinition> findById(Long id);

  Optional<RiskDefinition> findByIdAndDomainPackVersionId(Long id, Long domainPackVersionId);

  List<RiskDefinition> findAllByDomainPackVersionIdOrderByRiskCodeAsc(Long domainPackVersionId);

  RiskDefinition save(RiskDefinition risk);
}
