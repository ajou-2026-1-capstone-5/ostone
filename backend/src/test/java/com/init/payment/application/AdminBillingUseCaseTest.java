package com.init.payment.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.init.payment.application.exception.PaymentExceptions;
import com.init.payment.application.gateway.TossCancelResult;
import com.init.payment.application.gateway.TossPaymentGateway;
import com.init.payment.domain.model.Payment;
import com.init.payment.domain.model.PaymentCancel;
import com.init.payment.domain.model.PaymentStatus;
import com.init.payment.domain.repository.PaymentCancelRepository;
import com.init.payment.domain.repository.PaymentRepository;
import com.init.shared.application.exception.BusinessException;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;

@ExtendWith(MockitoExtension.class)
@DisplayName("AdminBillingUseCase")
class AdminBillingUseCaseTest {

  @Mock private AdminBillingQueryRepository queryRepository;
  @Mock private PaymentRepository paymentRepository;
  @Mock private PaymentCancelRepository paymentCancelRepository;
  @Mock private TossPaymentGateway tossPaymentGateway;
  @Mock private PlatformTransactionManager transactionManager;
  @InjectMocks private AdminBillingUseCase adminBillingUseCase;

  @BeforeEach
  void setUp() {
    lenient()
        .when(transactionManager.getTransaction(any()))
        .thenReturn(new SimpleTransactionStatus());
  }

  @Test
  @DisplayName("refundFull: Toss cancel 성공 → 결제 취소와 환불 기록 저장")
  void should_결제취소와환불기록저장_when_TossCancel성공() {
    // given
    Payment payment = completedPayment("ord_1", "pay_1");
    OffsetDateTime canceledAt = OffsetDateTime.parse("2026-06-03T12:00:00Z");
    given(paymentRepository.findByIdForUpdate(100L)).willReturn(Optional.of(payment));
    given(paymentCancelRepository.existsByPaymentId(100L)).willReturn(false);
    given(tossPaymentGateway.cancelPayment(eq("pay_1"), eq("고객 요청"), eq("admin-full-refund-100")))
        .willReturn(new TossCancelResult("tx_cancel_1", canceledAt));

    // when
    AdminBillingRefundResult result =
        adminBillingUseCase.refundFull(new AdminBillingRefundCommand(100L, "고객 요청"));

    // then
    assertThat(result.paymentStatus()).isEqualTo(PaymentStatus.CANCELED);
    assertThat(result.refundAmount()).isEqualTo(29_000L);
    assertThat(result.transactionKey()).isEqualTo("tx_cancel_1");
    ArgumentCaptor<PaymentCancel> cancelCaptor = ArgumentCaptor.forClass(PaymentCancel.class);
    verify(paymentCancelRepository).save(cancelCaptor.capture());
    assertThat(cancelCaptor.getValue().getReason()).isEqualTo("고객 요청");
    InOrder inOrder = inOrder(transactionManager, tossPaymentGateway);
    inOrder.verify(transactionManager).commit(any());
    inOrder.verify(tossPaymentGateway).cancelPayment("pay_1", "고객 요청", "admin-full-refund-100");
    ArgumentCaptor<TransactionDefinition> transactionCaptor =
        ArgumentCaptor.forClass(TransactionDefinition.class);
    verify(transactionManager, times(2)).getTransaction(transactionCaptor.capture());
    assertThat(transactionCaptor.getAllValues())
        .allSatisfy(
            definition ->
                assertThat(definition.getPropagationBehavior())
                    .isEqualTo(TransactionDefinition.PROPAGATION_REQUIRES_NEW));
  }

  @Test
  @DisplayName("refundFull: Toss 4xx 거절 → gateway rejected 코드로 실패")
  void should_GatewayRejected코드로실패_when_Toss거절() {
    // given
    Payment payment = completedPayment("ord_1", "pay_1");
    given(paymentRepository.findByIdForUpdate(100L)).willReturn(Optional.of(payment));
    given(paymentCancelRepository.existsByPaymentId(100L)).willReturn(false);
    given(tossPaymentGateway.cancelPayment(eq("pay_1"), eq("고객 요청"), eq("admin-full-refund-100")))
        .willThrow(PaymentExceptions.gatewayRejected("Toss가 환불 요청을 거절했습니다."));

    // when & then
    AdminBillingRefundCommand command = new AdminBillingRefundCommand(100L, "고객 요청");

    assertThatThrownBy(() -> adminBillingUseCase.refundFull(command))
        .isInstanceOf(BusinessException.class)
        .hasFieldOrPropertyWithValue("code", "PAYMENT_GATEWAY_REJECTED");
    verify(paymentCancelRepository, never()).save(any());
  }

  @Test
  @DisplayName("refundFull: Toss 장애 → gateway unavailable 코드로 실패")
  void should_GatewayUnavailable코드로실패_when_Toss장애() {
    // given
    Payment payment = completedPayment("ord_1", "pay_1");
    given(paymentRepository.findByIdForUpdate(100L)).willReturn(Optional.of(payment));
    given(paymentCancelRepository.existsByPaymentId(100L)).willReturn(false);
    given(tossPaymentGateway.cancelPayment(eq("pay_1"), eq("고객 요청"), eq("admin-full-refund-100")))
        .willThrow(PaymentExceptions.gatewayUnavailable(new IllegalStateException("timeout")));

    // when & then
    AdminBillingRefundCommand command = new AdminBillingRefundCommand(100L, "고객 요청");

    assertThatThrownBy(() -> adminBillingUseCase.refundFull(command))
        .isInstanceOf(BusinessException.class)
        .hasFieldOrPropertyWithValue("code", "PAYMENT_GATEWAY_UNAVAILABLE");
    verify(paymentCancelRepository, never()).save(any());
  }

  @Test
  @DisplayName("refundFull: 이미 환불 기록 있음 → Toss 호출 없이 실패")
  void should_Toss호출없이실패_when_이미환불기록있음() {
    // given
    Payment payment = completedPayment("ord_1", "pay_1");
    given(paymentRepository.findByIdForUpdate(100L)).willReturn(Optional.of(payment));
    given(paymentCancelRepository.existsByPaymentId(100L)).willReturn(true);

    // when & then
    AdminBillingRefundCommand command = new AdminBillingRefundCommand(100L, "고객 요청");

    assertThatThrownBy(() -> adminBillingUseCase.refundFull(command))
        .isInstanceOf(BusinessException.class)
        .hasFieldOrPropertyWithValue("code", "PAYMENT_ALREADY_REFUNDED");
    verify(tossPaymentGateway, never()).cancelPayment(any(), any(), any());
    verify(paymentCancelRepository, never()).save(any());
  }

  @Test
  @DisplayName("refundFull: Toss 호출 후 이미 환불 기록이 생기면 저장 없이 실패")
  void should_저장없이실패_when_Toss호출후이미환불됨() {
    // given
    Payment payment = completedPayment("ord_1", "pay_1");
    OffsetDateTime canceledAt = OffsetDateTime.parse("2026-06-03T12:00:00Z");
    given(paymentRepository.findByIdForUpdate(100L)).willReturn(Optional.of(payment));
    given(paymentCancelRepository.existsByPaymentId(100L)).willReturn(false, true);
    given(tossPaymentGateway.cancelPayment(eq("pay_1"), eq("고객 요청"), eq("admin-full-refund-100")))
        .willReturn(new TossCancelResult("tx_cancel_1", canceledAt));
    AdminBillingRefundCommand command = new AdminBillingRefundCommand(100L, "고객 요청");

    // when & then
    assertThatThrownBy(() -> adminBillingUseCase.refundFull(command))
        .isInstanceOf(BusinessException.class)
        .hasFieldOrPropertyWithValue("code", "PAYMENT_ALREADY_REFUNDED");
    verify(tossPaymentGateway).cancelPayment("pay_1", "고객 요청", "admin-full-refund-100");
    verify(paymentCancelRepository, never()).save(any());
  }

  @Test
  @DisplayName("refundFull: Toss 호출 후 결제 키가 바뀌면 저장 없이 실패")
  void should_저장없이실패_when_Toss호출후결제키변경됨() {
    // given
    Payment payment = completedPayment("ord_1", "pay_1");
    Payment changedPayment = completedPayment("ord_1", "pay_changed");
    OffsetDateTime canceledAt = OffsetDateTime.parse("2026-06-03T12:00:00Z");
    given(paymentRepository.findByIdForUpdate(100L))
        .willReturn(Optional.of(payment), Optional.of(changedPayment));
    given(paymentCancelRepository.existsByPaymentId(100L)).willReturn(false);
    given(tossPaymentGateway.cancelPayment(eq("pay_1"), eq("고객 요청"), eq("admin-full-refund-100")))
        .willReturn(new TossCancelResult("tx_cancel_1", canceledAt));
    AdminBillingRefundCommand command = new AdminBillingRefundCommand(100L, "고객 요청");

    // when & then
    assertThatThrownBy(() -> adminBillingUseCase.refundFull(command))
        .isInstanceOf(BusinessException.class)
        .hasFieldOrPropertyWithValue("code", "PAYMENT_NOT_REFUNDABLE");
    verify(tossPaymentGateway).cancelPayment("pay_1", "고객 요청", "admin-full-refund-100");
    verify(paymentCancelRepository, never()).save(any());
  }

  @Test
  @DisplayName("refundFull: 결제 키 없음 → Toss 호출 없이 환불 불가")
  void should_Toss호출없이실패_when_결제키없음() {
    // given
    Payment payment = completedPayment("ord_1", "pay_1");
    ReflectionTestUtils.setField(payment, "paymentKey", null);
    given(paymentRepository.findByIdForUpdate(100L)).willReturn(Optional.of(payment));
    given(paymentCancelRepository.existsByPaymentId(100L)).willReturn(false);

    // when & then
    AdminBillingRefundCommand command = new AdminBillingRefundCommand(100L, "고객 요청");

    assertThatThrownBy(() -> adminBillingUseCase.refundFull(command))
        .isInstanceOf(BusinessException.class)
        .hasFieldOrPropertyWithValue("code", "PAYMENT_NOT_REFUNDABLE");
    verify(tossPaymentGateway, never()).cancelPayment(any(), any(), any());
    verify(paymentCancelRepository, never()).save(any());
  }

  @Test
  @DisplayName("refundFull: 결제 없음 → not found 코드로 실패")
  void should_NotFound코드로실패_when_결제없음() {
    // given
    given(paymentRepository.findByIdForUpdate(100L)).willReturn(Optional.empty());
    AdminBillingRefundCommand command = new AdminBillingRefundCommand(100L, "고객 요청");

    // when & then
    assertThatThrownBy(() -> adminBillingUseCase.refundFull(command))
        .isInstanceOf(BusinessException.class)
        .hasFieldOrPropertyWithValue("code", "PAYMENT_NOT_FOUND");
    verify(tossPaymentGateway, never()).cancelPayment(any(), any(), any());
  }

  @Test
  @DisplayName("refundFull: DONE이 아닌 결제 → Toss 호출 없이 환불 불가")
  void should_Toss호출없이실패_when_완료상태아님() {
    // given
    Payment payment = completedPayment("ord_1", "pay_1");
    payment.refundFull("고객 요청", "tx_cancel_1", OffsetDateTime.now());
    given(paymentRepository.findByIdForUpdate(100L)).willReturn(Optional.of(payment));
    given(paymentCancelRepository.existsByPaymentId(100L)).willReturn(false);
    AdminBillingRefundCommand command = new AdminBillingRefundCommand(100L, "고객 요청");

    // when & then
    assertThatThrownBy(() -> adminBillingUseCase.refundFull(command))
        .isInstanceOf(BusinessException.class)
        .hasFieldOrPropertyWithValue("code", "PAYMENT_NOT_REFUNDABLE");
    verify(tossPaymentGateway, never()).cancelPayment(any(), any(), any());
    verify(paymentCancelRepository, never()).save(any());
  }

  @Test
  @DisplayName("AdminBillingRefundCommand: paymentId와 reason 필수")
  void should_필수값검증_when_환불명령생성() {
    assertThatThrownBy(() -> new AdminBillingRefundCommand(null, "고객 요청"))
        .isInstanceOf(BusinessException.class)
        .hasFieldOrPropertyWithValue("code", "PAYMENT_INVALID_REFUND_REQUEST");
    assertThatThrownBy(() -> new AdminBillingRefundCommand(100L, " "))
        .isInstanceOf(BusinessException.class)
        .hasFieldOrPropertyWithValue("code", "PAYMENT_INVALID_REFUND_REQUEST");
  }

  private Payment completedPayment(String orderId, String paymentKey) {
    Payment payment = Payment.createOrder(1L, 10L, orderId, 29_000L, "KRW", "Pro");
    ReflectionTestUtils.setField(payment, "id", 100L);
    payment.complete(paymentKey, "CARD", OffsetDateTime.now(), "https://receipt", "{}");
    return payment;
  }
}
