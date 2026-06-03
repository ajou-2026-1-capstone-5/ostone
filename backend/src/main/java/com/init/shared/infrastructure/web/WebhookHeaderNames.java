package com.init.shared.infrastructure.web;

public final class WebhookHeaderNames {

  public static final String AIRFLOW_WEBHOOK_SECRET = "X-Airflow-Webhook-Secret";
  public static final String TOSS_WEBHOOK_SECRET = "X-Toss-Webhook-Secret";

  private WebhookHeaderNames() {}
}
