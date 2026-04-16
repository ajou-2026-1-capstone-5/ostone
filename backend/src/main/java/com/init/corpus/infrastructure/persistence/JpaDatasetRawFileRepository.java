package com.init.corpus.infrastructure.persistence;

import com.init.corpus.domain.model.DatasetRawFile;
import com.init.corpus.domain.repository.DatasetRawFileRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaDatasetRawFileRepository
    extends JpaRepository<DatasetRawFile, Long>, DatasetRawFileRepository {}
