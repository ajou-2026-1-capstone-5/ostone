package com.init.pipelinejob.application;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.init.pipelinejob.application.exception.AirflowWebhookUnauthorizedException;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import com.init.pipelinejob.domain.repository.WebhookReceiptRepository;
import com.init.workspace.application.WorkspaceFreeOnboardingService;
import java.time.Clock;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;

@DisplayName("PipelineJobCallbackSupportService")
@ExtendWith(MockitoExtension.class)
class PipelineJobCallbackSupportServiceTest {

  @Mock private PipelineJobRepository pipelineJobRepository;
  @Mock private WebhookReceiptRepository webhookReceiptRepository;
  @Mock private PlatformTransactionManager transactionManager;
  @Mock private WorkspaceFreeOnboardingService freeOnboardingService;

  @Test
  @DisplayName("expected webhook secret이 blank이면 생성자가 거절한다")
  void constructor_withBlankWebhookSecret_throws() {
    assertThatThrownBy(() -> supportService("   "))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("airflow.webhook.secret");
  }

  @Test
  @DisplayName("expected secret이 설정되어 있으면 blank provided secret을 거절한다")
  void validateWebhookSecret_withBlankProvidedSecret_throwsUnauthorized() {
    PipelineJobCallbackSupportService service = supportService("test-airflow-webhook-secret");

    assertThatThrownBy(() -> service.validateWebhookSecret("   "))
        .isInstanceOf(AirflowWebhookUnauthorizedException.class);
  }

  private PipelineJobCallbackSupportService supportService(String airflowWebhookSecret) {
    return new PipelineJobCallbackSupportService(
        pipelineJobRepository,
        webhookReceiptRepository,
        Clock.systemUTC(),
        transactionManager,
        airflowWebhookSecret,
        freeOnboardingService);
  }
}
