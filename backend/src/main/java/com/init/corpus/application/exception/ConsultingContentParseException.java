package com.init.corpus.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class ConsultingContentParseException extends BadRequestException {
  public ConsultingContentParseException(String message) {
    super("CONSULTING_CONTENT_PARSE_ERROR", message);
  }
}
