package com.init.domainpack.domain.repository;

import com.init.domainpack.domain.model.IntentSlotBinding;
import java.util.List;

public interface IntentSlotBindingRepository {

  <S extends IntentSlotBinding> List<S> saveAll(Iterable<S> entities);
}
