package com.init.pipelinejob.domain.repository;

import com.init.pipelinejob.domain.model.PipelineArtifact;
import java.util.List;

public interface PipelineArtifactRepository {

  <S extends PipelineArtifact> S save(S artifact);

  List<PipelineArtifact> findByPipelineJobIdAndArtifactTypeOrderByCreatedAtDesc(
      Long pipelineJobId, String artifactType);
}
