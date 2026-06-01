package com.init.workflowruntime.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.workflowruntime.application.matching.EmbeddingClient;
import com.init.workflowruntime.application.matching.EmbeddingDisabledException;
import com.init.workflowruntime.application.matching.EmbeddingInputType;
import com.init.workflowruntime.application.matching.EmbeddingProperties;
import com.init.workflowruntime.infrastructure.embedding.BedrockCohereEmbeddingClient;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;

@Configuration
@EnableConfigurationProperties(EmbeddingProperties.class)
public class EmbeddingConfig {

  @Bean
  public EmbeddingClient embeddingClient(
      EmbeddingProperties properties, ObjectMapper objectMapper, MeterRegistry meterRegistry) {
    if (!properties.enabled() || !"bedrock".equalsIgnoreCase(properties.providerOrDefault())) {
      return new DisabledEmbeddingClient();
    }
    BedrockRuntimeClient client =
        BedrockRuntimeClient.builder()
            .region(Region.of(properties.bedrockRegionOrDefault()))
            .overrideConfiguration(
                ClientOverrideConfiguration.builder()
                    .apiCallAttemptTimeout(properties.timeoutOrDefault())
                    .apiCallTimeout(properties.timeoutOrDefault().multipliedBy(2))
                    .build())
            .build();
    return new BedrockCohereEmbeddingClient(client, objectMapper, properties, meterRegistry);
  }

  private static final class DisabledEmbeddingClient implements EmbeddingClient {
    @Override
    public float[] embed(String text, EmbeddingInputType inputType) {
      throw new EmbeddingDisabledException();
    }
  }
}
