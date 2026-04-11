package com.init.domainpack.infrastructure.persistence;

import com.init.domainpack.domain.model.IntentSlotBinding;
import com.init.domainpack.domain.repository.IntentSlotBindingRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaIntentSlotBindingRepository
    extends JpaRepository<IntentSlotBinding, Long>, IntentSlotBindingRepository {}
