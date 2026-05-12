package com.init.chatdemo.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.init.chatdemo.presentation.dto.DemoChatSessionEndpointResponse;
import com.init.chatdemo.presentation.dto.DemoChatSessionResponse;
import com.init.chatdemo.presentation.dto.DemoChatWorkflowResponse;
import com.init.chatdemo.presentation.dto.DemoDecisionLogEndpointResponse;
import com.init.chatdemo.presentation.dto.DemoExecutionResponse;
import com.init.chatdemo.presentation.dto.DemoMessageResponse;
import com.init.chatdemo.presentation.dto.DemoPolicyHitResponse;
import com.init.chatdemo.presentation.dto.DemoRiskHitResponse;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class DemoRuntimeMockServiceTest {

  private static final String SERVICE_CLASS_NAME =
      "com.init.chatdemo.application.DemoRuntimeMockService";
  private static final String FIXTURE_CLASS_NAME =
      "com.init.chatdemo.application.DemoRuntimeFixture";

  private static final Set<String> ALLOWED_EVENT_TYPES =
      Set.of(
          "INTENT_DETECTED",
          "ACTION_SELECTED",
          "SLOT_FILLED",
          "POLICY_CHECKED",
          "RISK_CHECKED",
          "STATE_TRANSITIONED",
          "ANSWER_GENERATED",
          "HANDOFF_TRIGGERED",
          "SESSION_COMPLETED");

  @Test
  @DisplayName("통합 응답의 decisionLogs와 개별 decision log 조회 결과가 동일하다")
  void should_match_when_comparingIntegratedAndIndividualDecisionLogs() {
    Object service = newService();
    DemoChatWorkflowResponse integratedResponse =
        invoke(service, "getChatWorkflow", DemoChatWorkflowResponse.class);

    DemoDecisionLogEndpointResponse individualDecisionLogsResponse =
        invoke(
            service,
            "getDecisionLogs",
            String.class,
            integratedResponse.execution().id(),
            DemoDecisionLogEndpointResponse.class);

    assertThat(individualDecisionLogsResponse.decisionLogs())
        .isEqualTo(integratedResponse.decisionLogs());
  }

  @Test
  @DisplayName("모든 decisionLog의 messageId가 messages ID 중 하나와 연결된다")
  void should_link_when_decisionLogMessageIdMatchesMessageId() {
    DemoChatWorkflowResponse response =
        invoke(newService(), "getChatWorkflow", DemoChatWorkflowResponse.class);
    Set<String> messageIds =
        response.messages().stream().map(DemoMessageResponse::id).collect(Collectors.toSet());

    assertThat(response.decisionLogs())
        .allSatisfy(decisionLog -> assertThat(messageIds).contains(decisionLog.messageId()));
  }

  @Test
  @DisplayName("모든 decisionLog의 confidence가 0.0 ~ 1.0 범위이다")
  void should_beInRange_when_checkingConfidenceBound() {
    DemoChatWorkflowResponse response =
        invoke(newService(), "getChatWorkflow", DemoChatWorkflowResponse.class);

    assertThat(response.decisionLogs())
        .allSatisfy(decisionLog -> assertThat(decisionLog.confidence()).isBetween(0.0, 1.0));
  }

  @Test
  @DisplayName("모든 decisionLog의 eventType이 허용된 9개 타입 중 하나이다")
  void should_beValid_when_checkingEventType() {
    DemoChatWorkflowResponse response =
        invoke(newService(), "getChatWorkflow", DemoChatWorkflowResponse.class);

    assertThat(response.decisionLogs())
        .allSatisfy(
            decisionLog -> assertThat(ALLOWED_EVENT_TYPES).contains(decisionLog.eventType()));
  }

  @Test
  @DisplayName("execution 응답에 slotValues, missingSlots, policyHits, riskHits가 포함된다")
  void should_containAllFields_when_checkingExecutionResponse() {
    Object service = newService();
    DemoChatWorkflowResponse response =
        invoke(service, "getChatWorkflow", DemoChatWorkflowResponse.class);
    DemoExecutionResponse execution =
        invoke(
            service,
            "getWorkflowExecution",
            String.class,
            response.execution().id(),
            DemoExecutionResponse.class);

    assertThat(execution.slotValues()).isNotNull().isInstanceOf(Map.class);
    assertThat(execution.missingSlots()).isNotNull().isInstanceOf(List.class);
    assertThat(execution.policyHits()).isNotNull().isNotEmpty();
    assertThat(execution.riskHits()).isNotNull().isNotEmpty();
    assertThat(execution.policyHits()).allSatisfy(this::assertPolicyHitFields);
    assertThat(execution.riskHits()).allSatisfy(this::assertRiskHitFields);
  }

  @Test
  @DisplayName("존재하지 않는 sessionId 조회 시 오류가 발생한다")
  void should_throw_when_lookingUpUnknownSession() {
    Object service = newService();

    assertThatThrownBy(
            () ->
                invoke(
                    service,
                    "getChatSession",
                    String.class,
                    "unknown-session-id",
                    DemoChatSessionEndpointResponse.class))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  @DisplayName("존재하지 않는 executionId 조회 시 오류가 발생한다")
  void should_throw_when_lookingUpUnknownExecution() {
    Object service = newService();

    assertThatThrownBy(
            () ->
                invoke(
                    service,
                    "getWorkflowExecution",
                    String.class,
                    "unknown-execution-id",
                    DemoExecutionResponse.class))
        .isInstanceOf(NotFoundException.class);

    assertThatThrownBy(
            () ->
                invoke(
                    service,
                    "getDecisionLogs",
                    String.class,
                    "unknown-execution-id",
                    DemoDecisionLogEndpointResponse.class))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  @DisplayName("blank executionId로 decisionLogs 조회 시 오류가 발생한다")
  void should_throw_when_lookingUpBlankDecisionLogsExecutionId() {
    Object service = newService();

    assertThatThrownBy(
            () ->
                invoke(
                    service,
                    "getDecisionLogs",
                    String.class,
                    " ",
                    DemoDecisionLogEndpointResponse.class))
        .isInstanceOf(BadRequestException.class);
  }

  @Test
  @DisplayName("모든 decisionLog의 stateFrom과 stateTo가 null 또는 blank가 아니다")
  void should_notBeBlank_when_checkingDecisionLogStates() {
    DemoChatWorkflowResponse response =
        invoke(newService(), "getChatWorkflow", DemoChatWorkflowResponse.class);

    assertThat(response.decisionLogs())
        .allSatisfy(
            decisionLog -> {
              assertThat(decisionLog.stateFrom()).isNotBlank();
              assertThat(decisionLog.stateTo()).isNotBlank();
            });
  }

  @Test
  @DisplayName("동일 sessionId로 여러 번 조회해도 동일한 결과를 반환한다")
  void should_beConsistent_when_lookingUpSameSessionMultipleTimes() {
    Object fixture = newFixture();
    DemoChatWorkflowResponse response =
        invoke(fixture, "provideChatWorkflow", DemoChatWorkflowResponse.class);
    String sessionId = response.chatSession().id();

    DemoChatSessionResponse firstSession =
        invoke(fixture, "findSession", String.class, sessionId, DemoChatSessionResponse.class);
    DemoChatSessionResponse secondSession =
        invoke(fixture, "findSession", String.class, sessionId, DemoChatSessionResponse.class);
    List<DemoMessageResponse> firstMessages =
        invokeList(
            fixture, "findSessionMessages", String.class, sessionId, DemoMessageResponse.class);
    List<DemoMessageResponse> secondMessages =
        invokeList(
            fixture, "findSessionMessages", String.class, sessionId, DemoMessageResponse.class);

    assertThat(secondSession).isEqualTo(firstSession);
    assertThat(secondMessages).isEqualTo(firstMessages);
  }

  private Object newService() {
    Object fixture = newFixture();
    Class<?> serviceClass = runtimeClass(SERVICE_CLASS_NAME);
    Constructor<?> constructor = constructor(serviceClass, fixture.getClass());
    return instantiate(constructor, fixture);
  }

  private Object newFixture() {
    return instantiate(constructor(runtimeClass(FIXTURE_CLASS_NAME)));
  }

  private Class<?> runtimeClass(String className) {
    try {
      return Class.forName(className);
    } catch (ClassNotFoundException exception) {
      throw new IllegalStateException(
          "Required demo runtime contract class is missing: " + className, exception);
    }
  }

  private Constructor<?> constructor(Class<?> type, Class<?>... parameterTypes) {
    try {
      return type.getDeclaredConstructor(parameterTypes);
    } catch (NoSuchMethodException exception) {
      throw new IllegalStateException(
          "Required constructor is missing: " + type.getName(), exception);
    }
  }

  private Object instantiate(Constructor<?> constructor, Object... arguments) {
    try {
      return constructor.newInstance(arguments);
    } catch (InstantiationException | IllegalAccessException exception) {
      throw new IllegalStateException("Failed to create demo runtime contract instance", exception);
    } catch (InvocationTargetException exception) {
      throw rethrowRuntime(exception.getCause());
    }
  }

  private <T> T invoke(Object target, String methodName, Class<T> returnType) {
    return invoke(target, methodName, null, null, returnType);
  }

  private <T> T invoke(
      Object target,
      String methodName,
      Class<?> parameterType,
      Object argument,
      Class<T> returnType) {
    return returnType.cast(invokeRaw(target, methodName, parameterType, argument));
  }

  private <T> List<T> invokeList(
      Object target,
      String methodName,
      Class<?> parameterType,
      Object argument,
      Class<T> elementType) {
    Object result = invokeRaw(target, methodName, parameterType, argument);
    assertThat(result).isInstanceOf(List.class);
    return ((List<?>) result).stream().map(elementType::cast).toList();
  }

  private Object invokeRaw(
      Object target, String methodName, Class<?> parameterType, Object argument) {
    try {
      Method method =
          parameterType == null
              ? target.getClass().getDeclaredMethod(methodName)
              : target.getClass().getDeclaredMethod(methodName, parameterType);
      return parameterType == null ? method.invoke(target) : method.invoke(target, argument);
    } catch (NoSuchMethodException | IllegalAccessException exception) {
      throw new IllegalStateException("Required method is missing: " + methodName, exception);
    } catch (InvocationTargetException exception) {
      throw rethrowRuntime(exception.getCause());
    }
  }

  private RuntimeException rethrowRuntime(Throwable cause) {
    if (cause instanceof RuntimeException runtimeException) {
      return runtimeException;
    }
    if (cause instanceof Error error) {
      throw error;
    }
    return new IllegalStateException("Demo runtime contract invocation failed", cause);
  }

  private void assertPolicyHitFields(DemoPolicyHitResponse policyHit) {
    assertThat(policyHit.policyId()).isNotBlank();
    assertThat(policyHit.policyName()).isNotBlank();
    assertThat(policyHit.result()).isNotBlank();
    assertThat(policyHit.detail()).isNotBlank();
  }

  private void assertRiskHitFields(DemoRiskHitResponse riskHit) {
    assertThat(riskHit.riskId()).isNotBlank();
    assertThat(riskHit.riskName()).isNotBlank();
    assertThat(riskHit.result()).isNotBlank();
    assertThat(riskHit.detail()).isNotBlank();
  }
}
