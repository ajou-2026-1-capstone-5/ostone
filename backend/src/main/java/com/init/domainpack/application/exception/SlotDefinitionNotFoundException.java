package com.init.domainpack.application.exception;

import com.init.shared.application.exception.NotFoundException;

public class SlotDefinitionNotFoundException extends NotFoundException {
  public SlotDefinitionNotFoundException(Long slotId) {
    super("SLOT_DEFINITION_NOT_FOUND", "SlotDefinition not found: " + slotId);
  }
}
