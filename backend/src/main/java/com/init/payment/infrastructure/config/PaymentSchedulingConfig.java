package com.init.payment.infrastructure.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** 정기결제 인앱 스케줄러 활성화 (U-001: Spring @Scheduled). */
@Configuration
@EnableScheduling
public class PaymentSchedulingConfig {}
