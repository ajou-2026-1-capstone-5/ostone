package com.init.domainpack.application.exception;

import com.init.shared.application.exception.NotFoundException;

public class DomainPackDraftEntryNotFoundException extends NotFoundException {

  public DomainPackDraftEntryNotFoundException(Long workspaceId) {
    super(
        "DOMAIN_PACK_DRAFT_ENTRY_NOT_FOUND",
        "Draft domain pack version not found for workspace: " + workspaceId);
  }
}
