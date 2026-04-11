package com.init.domainpack.infrastructure.persistence;

import com.init.domainpack.domain.model.IntentWorkflowBinding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaIntentWorkflowBindingRepository
    extends JpaRepository<IntentWorkflowBinding, Long> {}
