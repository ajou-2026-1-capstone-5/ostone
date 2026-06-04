package com.init.payment.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminBillingRefundRequest(
    @NotBlank(message = "환불 사유를 입력해주세요.") @Size(max = 500, message = "환불 사유는 500자 이하로 입력해주세요.")
        String reason) {}
