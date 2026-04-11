package com.init.domainpack.domain.repository;

import com.init.domainpack.domain.model.SlotDefinition;
import java.util.List;

public interface SlotDefinitionRepository {

  <S extends SlotDefinition> List<S> saveAll(Iterable<S> entities);
}
