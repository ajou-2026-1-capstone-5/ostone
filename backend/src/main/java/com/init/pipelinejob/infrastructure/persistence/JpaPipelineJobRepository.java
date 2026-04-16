package com.init.pipelinejob.infrastructure.persistence;

import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaPipelineJobRepository
    extends JpaRepository<PipelineJob, Long>, PipelineJobRepository {}
