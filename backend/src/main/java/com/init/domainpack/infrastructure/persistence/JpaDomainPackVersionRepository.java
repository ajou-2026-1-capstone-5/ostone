package com.init.domainpack.infrastructure.persistence;

import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaDomainPackVersionRepository
    extends JpaRepository<DomainPackVersion, Long>, DomainPackVersionRepository {}
