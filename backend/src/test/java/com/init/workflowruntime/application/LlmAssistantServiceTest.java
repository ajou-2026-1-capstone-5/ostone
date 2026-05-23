package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

import java.util.function.Consumer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.ChatClient.CallResponseSpec;
import org.springframework.ai.chat.client.ChatClient.ChatClientRequestSpec;

@ExtendWith(MockitoExtension.class)
@DisplayName("LlmAssistantService")
class LlmAssistantServiceTest {

  @Mock private ChatClient chatClient;
  @Mock private ChatClientRequestSpec promptSpec;
  @Mock private CallResponseSpec callSpec;

  private LlmAssistantService service;

  @BeforeEach
  void setUp() {
    service = new LlmAssistantService(chatClient);
  }

  @Test
  @DisplayName("generateResponse: 유저 메시지 → LLM 응답 반환")
  void should_returnLlmResponse_when_userMessageProvided() {
    given(chatClient.prompt()).willReturn(promptSpec);
    given(promptSpec.user(any(Consumer.class))).willReturn(promptSpec);
    given(promptSpec.call()).willReturn(callSpec);
    given(callSpec.content()).willReturn("안녕하세요! 무엇을 도와드릴까요?");

    String result = service.generateResponse("기존 대화 컨텍스트", "안녕하세요");

    assertThat(result).isEqualTo("안녕하세요! 무엇을 도와드릴까요?");
  }
}
