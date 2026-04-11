package com.init.domainpack.domain.repository;

import com.init.domainpack.domain.model.PolicyDefinition;
import java.util.List;

public interface PolicyDefinitionRepository {

  <S extends PolicyDefinition> List<S> saveAll(Iterable<S> entities);
}
