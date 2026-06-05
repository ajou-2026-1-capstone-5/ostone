package com.init.payment.application;

public enum QuotaResource {
  DATASET_UPLOAD("DATASET_UPLOAD"),
  PIPELINE_RUN("PIPELINE_RUN"),
  DOMAIN_PACK_OPERATION("DOMAIN_PACK_OPERATION"),
  MEMBER("MEMBER");

  private final String code;

  QuotaResource(String code) {
    this.code = code;
  }

  public String code() {
    return code;
  }
}
