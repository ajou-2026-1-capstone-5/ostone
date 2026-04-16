package com.init.pipelinejob.infrastructure.persistence;

import com.init.pipelinejob.domain.model.PipelineArtifact;
import com.init.pipelinejob.domain.repository.PipelineArtifactRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaPipelineArtifactRepository
    extends JpaRepository<PipelineArtifact, Long>, PipelineArtifactRepository {}
