package com.init.domainpack.domain.repository;

import com.init.domainpack.domain.model.DomainPackVersion;
import java.util.Optional;

public interface DomainPackVersionRepository {

  Optional<DomainPackVersion> findById(Long id);

  DomainPackVersion save(DomainPackVersion version);
}
