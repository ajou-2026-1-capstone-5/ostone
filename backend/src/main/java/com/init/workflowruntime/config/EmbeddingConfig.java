package com.init.workflowruntime.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.workflowruntime.application.matching.EmbeddingClient;
import com.init.workflowruntime.application.matching.EmbeddingDisabledException;
import com.init.workflowruntime.application.matching.EmbeddingInputType;
import com.init.workflowruntime.application.matching.EmbeddingProperties;
import com.init.workflowruntime.infrastructure.embedding.BedrockCohereEmbeddingClient;
import com.init.workflowruntime.infrastructure.embedding.OpenAiEmbeddingClient;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;

@Configuration
@EnableConfigurationProperties(EmbeddingProperties.class)
public class EmbeddingConfig {

  @Bean
  public EmbeddingClient embeddingClient(
      EmbeddingProperties properties,
      ObjectMapper objectMapper,
      MeterRegistry meterRegistry,
      @Value("${spring.ai.openai.api-key:}") String openAiApiKey,
      @Value("${spring.ai.openai.base-url:https://api.openai.com}") String openAiBaseUrl,
      @Value("${app.ai.embedding.dimensions:1024}") int dimensions) {
    if (!properties.enabled()) {
      return new DisabledEmbeddingClient();
    }
    String provider = properties.providerOrDefault();
    if ("openai".equalsIgnoreCase(provider)) {
      if (openAiApiKey == null || openAiApiKey.isBlank()) {
        throw new IllegalStateException(
            "spring.ai.openai.api-key must be set when app.ai.embedding.provider=openai");
      }
      if (dimensions <= 0) {
        throw new IllegalArgumentException("app.ai.embedding.dimensions must be positive");
      }
      Duration timeout = properties.timeoutOrDefault();
      SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
      requestFactory.setConnectTimeout(timeout);
      requestFactory.setReadTimeout(timeout);
      RestClient restClient =
          RestClient.builder()
              .baseUrl(openAiBaseUrl)
              .requestFactory(requestFactory)
              .defaultHeader("Authorization", "Bearer " + openAiApiKey)
              .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
              .build();
      return new OpenAiEmbeddingClient(
          restClient, objectMapper, meterRegistry, properties.modelOrDefault(), dimensions);
    }
    if (!"bedrock".equalsIgnoreCase(provider)) {
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
