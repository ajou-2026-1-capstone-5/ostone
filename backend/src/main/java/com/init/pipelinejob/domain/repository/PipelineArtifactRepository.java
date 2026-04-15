package com.init.pipelinejob.domain.repository;

import com.init.pipelinejob.domain.model.PipelineArtifact;

public interface PipelineArtifactRepository {

  <S extends PipelineArtifact> S save(S artifact);
}
