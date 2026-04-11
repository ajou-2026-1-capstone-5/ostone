package com.init.domainpack.domain.repository;

import com.init.domainpack.domain.model.RiskDefinition;
import java.util.List;

public interface RiskDefinitionRepository {

  <S extends RiskDefinition> List<S> saveAll(Iterable<S> entities);
}
