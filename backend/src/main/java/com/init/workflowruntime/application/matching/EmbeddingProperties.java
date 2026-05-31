package com.init.workflowruntime.application.matching;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.ai.embedding")
public record EmbeddingProperties(
    String provider,
    boolean enabled,
    String model,
    String bedrockRegion,
    Duration timeout,
    Duration profileBuildInterval,
    Duration profileBuildRunningTimeout,
    Duration queryCacheTtl,
    int topK,
    double autoRunReplayFitnessThreshold,
    double confidentThreshold,
    double ambiguousThreshold,
    double confidentMargin,
    double semanticFloor,
    double routeEvidenceFloor,
    double lexicalEvidenceFloor) {

  public String providerOrDefault() {
    return hasText(provider) ? provider : "disabled";
  }

  public String modelOrDefault() {
    return hasText(model) ? model : "cohere.embed-multilingual-v3";
  }

  public String bedrockRegionOrDefault() {
    return hasText(bedrockRegion) ? bedrockRegion : "ap-northeast-1";
  }

  public Duration timeoutOrDefault() {
    return timeout == null ? Duration.ofSeconds(5) : timeout;
  }

  public Duration queryCacheTtlOrDefault() {
    return queryCacheTtl == null ? Duration.ofMinutes(5) : queryCacheTtl;
  }

  public Duration profileBuildRunningTimeoutOrDefault() {
    return profileBuildRunningTimeout == null ? Duration.ofMinutes(15) : profileBuildRunningTimeout;
  }

  public int topKOrDefault() {
    return topK <= 0 ? 30 : topK;
  }

  public double autoRunReplayFitnessThresholdOrDefault() {
    return autoRunReplayFitnessThreshold <= 0.0 ? 0.70 : autoRunReplayFitnessThreshold;
  }

  public double confidentThresholdOrDefault() {
    return confidentThreshold <= 0.0 ? 0.72 : confidentThreshold;
  }

  public double ambiguousThresholdOrDefault() {
    return ambiguousThreshold <= 0.0 ? 0.55 : ambiguousThreshold;
  }

  public double confidentMarginOrDefault() {
    return confidentMargin <= 0.0 ? 0.10 : confidentMargin;
  }

  public double semanticFloorOrDefault() {
    return semanticFloor <= 0.0 ? 0.65 : semanticFloor;
  }

  public double routeEvidenceFloorOrDefault() {
    return routeEvidenceFloor <= 0.0 ? 0.50 : routeEvidenceFloor;
  }

  public double lexicalEvidenceFloorOrDefault() {
    return lexicalEvidenceFloor <= 0.0 ? 0.30 : lexicalEvidenceFloor;
  }

  private static boolean hasText(String value) {
    return value != null && !value.isBlank();
  }
}
