package com.init.domainpack.infrastructure;

import com.init.domainpack.application.AddIntentsToDraftVersionCommand;
import com.init.domainpack.application.AddIntentsToDraftVersionUseCase;
import com.init.domainpack.application.IntentDraft;
import com.init.pipelinejob.application.AddIntentsToDraftVersionPort;
import com.init.pipelinejob.application.AddIntentsToDraftVersionPortCommand;
import com.init.pipelinejob.application.AddIntentsToDraftVersionPortResult;
import com.init.pipelinejob.application.IntentDraftInput;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class AddIntentsToDraftVersionPortAdapter implements AddIntentsToDraftVersionPort {

  private final AddIntentsToDraftVersionUseCase addIntentsToDraftVersionUseCase;

  public AddIntentsToDraftVersionPortAdapter(
      AddIntentsToDraftVersionUseCase addIntentsToDraftVersionUseCase) {
    this.addIntentsToDraftVersionUseCase = addIntentsToDraftVersionUseCase;
  }

  @Override
  public AddIntentsToDraftVersionPortResult execute(AddIntentsToDraftVersionPortCommand command) {
    var result =
        addIntentsToDraftVersionUseCase.execute(
            new AddIntentsToDraftVersionCommand(
                command.domainPackVersionId(), toIntentDrafts(command.intents())));
    return new AddIntentsToDraftVersionPortResult(
        result.domainPackVersionId(),
        result.domainPackId(),
        result.addedIntentCount(),
        result.skippedIntentCount(),
        result.totalIntentCount());
  }

  private List<IntentDraft> toIntentDrafts(List<IntentDraftInput> inputs) {
    return inputs.stream()
        .map(
            i ->
                new IntentDraft(
                    i.intentCode(),
                    i.name(),
                    i.description(),
                    i.taxonomyLevel(),
                    i.parentIntentCode(),
                    i.sourceClusterRef(),
                    i.entryConditionJson(),
                    i.evidenceJson(),
                    i.metaJson()))
        .toList();
  }
}
