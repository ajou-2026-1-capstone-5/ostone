package com.init.domainpack.domain.repository;

import com.init.domainpack.domain.model.WorkflowDefinition;
import java.util.List;

public interface WorkflowDefinitionRepository {

  <S extends WorkflowDefinition> List<S> saveAll(Iterable<S> entities);
}
