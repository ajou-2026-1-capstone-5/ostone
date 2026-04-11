package com.init.domainpack.domain.repository;

import com.init.domainpack.domain.model.IntentDefinition;
import java.util.List;

public interface IntentDefinitionRepository {

  <S extends IntentDefinition> List<S> saveAll(Iterable<S> entities);

  <S extends IntentDefinition> List<S> saveAllAndFlush(Iterable<S> entities);
}
