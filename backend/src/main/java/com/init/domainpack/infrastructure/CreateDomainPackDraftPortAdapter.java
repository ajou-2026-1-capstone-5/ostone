package com.init.domainpack.infrastructure;

import com.init.domainpack.application.CreateDomainPackDraftFromPipelineCommand;
import com.init.domainpack.application.CreateDomainPackDraftFromPipelineUseCase;
import com.init.pipelinejob.application.CreateDomainPackDraftPort;
import com.init.pipelinejob.application.CreateDomainPackDraftPortCommand;
import com.init.pipelinejob.application.CreateDomainPackDraftPortResult;
import org.springframework.stereotype.Component;

@Component
public class CreateDomainPackDraftPortAdapter implements CreateDomainPackDraftPort {

  private final CreateDomainPackDraftFromPipelineUseCase createDomainPackDraftFromPipelineUseCase;

  public CreateDomainPackDraftPortAdapter(
      CreateDomainPackDraftFromPipelineUseCase createDomainPackDraftFromPipelineUseCase) {
    this.createDomainPackDraftFromPipelineUseCase = createDomainPackDraftFromPipelineUseCase;
  }

  @Override
  public CreateDomainPackDraftPortResult execute(CreateDomainPackDraftPortCommand command) {
    var result =
        createDomainPackDraftFromPipelineUseCase.execute(
            new CreateDomainPackDraftFromPipelineCommand(
                command.workspaceId(),
                command.packKey(),
                command.packName(),
                command.sourcePipelineJobId(),
                command.summaryJson()));
    return new CreateDomainPackDraftPortResult(
        result.domainPackId(),
        result.domainPackVersionId(),
        result.versionNo(),
        result.packKey(),
        result.createdPack(),
        result.sourcePipelineJobId());
  }
}
