package com.init.pipelinejob.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "pipeline_artifact", schema = "pipeline")
public class PipelineArtifact {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "pipeline_job_id", nullable = false, updatable = false)
  private Long pipelineJobId;

  @Column(name = "stage_name", nullable = false)
  private String stageName;

  @Column(name = "artifact_type", nullable = false)
  private String artifactType;

  @Column(name = "artifact_uri")
  private String artifactUri;

  @Column(name = "content_hash")
  private String contentHash;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "payload_json", columnDefinition = "jsonb", nullable = false)
  private String payloadJson;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  protected PipelineArtifact() {}

  public static PipelineArtifact create(
      Long pipelineJobId,
      String stageName,
      String artifactType,
      String artifactUri,
      String contentHash,
      String payloadJson,
      OffsetDateTime createdAt) {
    PipelineArtifact artifact = new PipelineArtifact();
    artifact.pipelineJobId = pipelineJobId;
    artifact.stageName = stageName;
    artifact.artifactType = artifactType;
    artifact.artifactUri = artifactUri;
    artifact.contentHash = contentHash;
    artifact.payloadJson = payloadJson != null ? payloadJson : "{}";
    artifact.createdAt = createdAt;
    return artifact;
  }
}
