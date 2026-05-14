package com.init.pipelinejob.infrastructure.corpus;

import static org.mockito.Mockito.verify;

import com.init.pipelinejob.application.TriggerIngestionUseCase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("CorpusIngestionTriggerAdapter")
class CorpusIngestionTriggerAdapterTest {

  @Mock private TriggerIngestionUseCase useCase;
  @InjectMocks private CorpusIngestionTriggerAdapter adapter;

  @Test
  @DisplayName("trigger_delegatesToUseCase")
  void trigger_delegatesToUseCase() {
    adapter.trigger(1L, 42L, "workspaces/1/key.json");

    verify(useCase).execute(1L, 42L, "workspaces/1/key.json");
  }
}
