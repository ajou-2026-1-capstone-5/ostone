package com.init.workflowruntime.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("LlmAutoResponseProperties")
class LlmAutoResponsePropertiesTest {

  @Test
  @DisplayName("executor 설정: 값이 없으면 시연용 기본 동시성 한도를 사용한다")
  void should_useDemoDefaults_when_valuesAreMissing() {
    LlmAutoResponseProperties properties = new LlmAutoResponseProperties(0, 0, -1, 0);

    assertThat(properties.coreSizeOrDefault()).isEqualTo(4);
    assertThat(properties.maxSizeOrDefault()).isEqualTo(8);
    assertThat(properties.queueCapacityOrDefault()).isEqualTo(16);
    assertThat(properties.keepAliveSecondsOrDefault()).isEqualTo(60);
  }

  @Test
  @DisplayName("executor 설정: maxSize는 coreSize보다 작아지지 않는다")
  void should_raiseMaxSize_when_configuredBelowCoreSize() {
    LlmAutoResponseProperties properties = new LlmAutoResponseProperties(6, 2, 10, 30);

    assertThat(properties.coreSizeOrDefault()).isEqualTo(6);
    assertThat(properties.maxSizeOrDefault()).isEqualTo(6);
    assertThat(properties.queueCapacityOrDefault()).isEqualTo(10);
    assertThat(properties.keepAliveSecondsOrDefault()).isEqualTo(30);
  }
}
