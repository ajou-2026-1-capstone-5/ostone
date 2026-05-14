package com.init.pipelinejob.infrastructure.corpus;

import com.init.corpus.application.port.IngestionTriggerPort;
import com.init.pipelinejob.application.TriggerIngestionUseCase;
import org.springframework.stereotype.Component;

@Component
public class CorpusIngestionTriggerAdapter implements IngestionTriggerPort {

  private final TriggerIngestionUseCase useCase;

  public CorpusIngestionTriggerAdapter(TriggerIngestionUseCase useCase) {
    this.useCase = useCase;
  }

  @Override
  public void trigger(Long workspaceId, Long datasetId, String objectKey) {
    useCase.execute(workspaceId, datasetId, objectKey);
  }
}
