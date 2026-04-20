package com.init.domainpack.infrastructure.persistence;

import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaIntentDefinitionRepository
    extends JpaRepository<IntentDefinition, Long>, IntentDefinitionRepository {

  List<IntentDefinition> findByDomainPackVersionId(Long domainPackVersionId);

  Optional<IntentDefinition> findByIdAndDomainPackVersionId(Long id, Long domainPackVersionId);
}
