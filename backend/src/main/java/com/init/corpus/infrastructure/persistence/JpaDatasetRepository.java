package com.init.corpus.infrastructure.persistence;

import com.init.corpus.domain.model.Dataset;
import com.init.corpus.domain.repository.DatasetRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaDatasetRepository extends JpaRepository<Dataset, Long>, DatasetRepository {}
