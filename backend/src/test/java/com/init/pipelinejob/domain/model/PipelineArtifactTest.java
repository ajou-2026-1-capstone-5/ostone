package com.init.pipelinejob.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

@DisplayName("PipelineArtifact")
class PipelineArtifactTest {

  @Test
  @DisplayName("artifact 정보를 그대로 보관한다")
  void create_withValues_setsFields() {
    OffsetDateTime createdAt = OffsetDateTime.parse("2026-06-01T01:00:00Z");

    PipelineArtifact artifact =
        PipelineArtifact.create(
            7L,
            "domain_confirmation",
            "DOMAIN_CANDIDATES",
            "s3://bucket/a.json",
            "hash",
            "{\"ok\":true}",
            createdAt);

    assertThat(ReflectionTestUtils.getField(artifact, "pipelineJobId")).isEqualTo(7L);
    assertThat(ReflectionTestUtils.getField(artifact, "stageName"))
        .isEqualTo("domain_confirmation");
    assertThat(ReflectionTestUtils.getField(artifact, "artifactType"))
        .isEqualTo("DOMAIN_CANDIDATES");
    assertThat(ReflectionTestUtils.getField(artifact, "contentHash")).isEqualTo("hash");
    assertThat(ReflectionTestUtils.getField(artifact, "createdAt")).isEqualTo(createdAt);
    assertThat(artifact.getArtifactUri()).isEqualTo("s3://bucket/a.json");
    assertThat(artifact.getPayloadJson()).isEqualTo("{\"ok\":true}");
  }

  @Test
  @DisplayName("payload와 생성 시간이 없으면 기본값을 사용한다")
  void create_withNullPayloadAndCreatedAt_usesDefaults() {
    OffsetDateTime before = OffsetDateTime.now().minusSeconds(1);

    PipelineArtifact artifact =
        PipelineArtifact.create(7L, "stage", "TYPE", null, null, null, null);

    assertThat(artifact.getArtifactUri()).isNull();
    assertThat(artifact.getPayloadJson()).isEqualTo("{}");
    assertThat((OffsetDateTime) ReflectionTestUtils.getField(artifact, "createdAt"))
        .isAfter(before);
  }
}
