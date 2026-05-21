package com.init.workflowruntime.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("AiConfig")
class AiConfigTest {

  @Test
  @DisplayName("AiConfig 인스턴스 생성")
  void should_createInstance() {
    AiConfig config = new AiConfig();
    assertThat(config).isNotNull();
  }
}
