package com.init.domainpack.domain.repository;

import com.init.domainpack.domain.model.IntentWorkflowBinding;
import java.util.List;

public interface IntentWorkflowBindingRepository {

  <S extends IntentWorkflowBinding> List<S> saveAll(Iterable<S> entities);

  <S extends IntentWorkflowBinding> List<S> saveAllAndFlush(Iterable<S> entities);

  List<IntentWorkflowBinding> findAllByIntentDefinitionIdIn(List<Long> intentDefinitionIds);
}
