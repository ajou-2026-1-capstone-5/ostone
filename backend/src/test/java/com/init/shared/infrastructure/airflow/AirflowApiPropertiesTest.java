package com.init.shared.infrastructure.airflow;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.validation.ValidationAutoConfiguration;
import org.springframework.boot.context.properties.bind.validation.BindValidationException;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

@DisplayName("AirflowApiProperties")
class AirflowApiPropertiesTest {

  private final ApplicationContextRunner contextRunner =
      new ApplicationContextRunner()
          .withConfiguration(AutoConfigurations.of(ValidationAutoConfiguration.class))
          .withUserConfiguration(AirflowApiConfig.class);

  @Test
  @DisplayName("webhook secret이 비어 있지 않으면 설정을 바인딩한다")
  void bind_withNonBlankWebhookSecret_succeeds() {
    contextRunner
        .withPropertyValues("airflow.webhook.secret=test-airflow-webhook-secret")
        .run(
            context -> {
              assertThat(context).hasNotFailed();
              assertThat(context.getBean(AirflowApiProperties.class).webhook().secret())
                  .isEqualTo("test-airflow-webhook-secret");
            });
  }

  @Test
  @DisplayName("webhook secret이 blank이면 애플리케이션 컨텍스트가 실패한다")
  void bind_withBlankWebhookSecret_fails() {
    contextRunner
        .withPropertyValues("airflow.webhook.secret=   ")
        .run(
            context -> {
              assertThat(context).hasFailed();
              assertThat(context.getStartupFailure())
                  .hasRootCauseInstanceOf(BindValidationException.class)
                  .hasStackTraceContaining("webhook.secret");
            });
  }
}
