package com.init.workflowruntime.application.matching;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("EmbeddingProperties")
class EmbeddingPropertiesTest {

  @Test
  @DisplayName("model과 Bedrock region이 비어 있으면 production 기본값을 사용한다")
  void should_useProductionDefaults_when_modelAndRegionAreBlank() {
    EmbeddingProperties properties = properties("", " ");

    assertThat(properties.modelOrDefault()).isEqualTo("cohere.embed-v4:0");
    assertThat(properties.bedrockRegionOrDefault()).isEqualTo("ap-northeast-2");
  }

  @Test
  @DisplayName("model과 Bedrock region이 지정되어 있으면 입력값을 유지한다")
  void should_keepConfiguredModelAndRegion_when_valuesHaveText() {
    EmbeddingProperties properties = properties("cohere.embed-multilingual-v3", "ap-northeast-1");

    assertThat(properties.modelOrDefault()).isEqualTo("cohere.embed-multilingual-v3");
    assertThat(properties.bedrockRegionOrDefault()).isEqualTo("ap-northeast-1");
  }

  private EmbeddingProperties properties(String model, String bedrockRegion) {
    return new EmbeddingProperties(
        "bedrock",
        true,
        model,
        bedrockRegion,
        Duration.ofSeconds(5),
        Duration.ofSeconds(30),
        Duration.ofMinutes(15),
        Duration.ofMinutes(5),
        30,
        0.70,
        0.72,
        0.55,
        0.10,
        0.65,
        0.50,
        0.30);
  }
}
