package com.init.pipelinejob.infrastructure.corpus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.corpus.domain.model.Dataset;
import com.init.corpus.domain.model.DatasetStatus;
import com.init.corpus.domain.repository.DatasetRepository;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("CorpusIngestionDatasetStatusAdapter")
class CorpusIngestionDatasetStatusAdapterTest {

  @Mock private DatasetRepository datasetRepository;

  @Test
  @DisplayName("인제스천 트리거 실패 시 PROCESSING dataset을 ERROR로 저장한다")
  void markIngestionTriggerFailed_fromProcessing_savesErrorDataset() {
    Dataset dataset = Dataset.createUploading(1L, "key", "테스트", "CRM", 1L);
    dataset.markProcessing();
    given(datasetRepository.findByIdAndWorkspaceIdForUpdate(42L, 1L))
        .willReturn(Optional.of(dataset));
    CorpusIngestionDatasetStatusAdapter adapter =
        new CorpusIngestionDatasetStatusAdapter(datasetRepository);

    adapter.markIngestionTriggerFailed(1L, 42L);

    assertThat(dataset.getStatus()).isEqualTo(DatasetStatus.ERROR);
    verify(datasetRepository).save(dataset);
  }

  @Test
  @DisplayName("이미 DONE dataset이면 상태를 바꾸거나 저장하지 않는다")
  void markIngestionTriggerFailed_fromDone_doesNotSave() {
    Dataset dataset = Dataset.createUploading(1L, "key", "테스트", "CRM", 1L);
    ReflectionTestUtils.setField(dataset, "status", DatasetStatus.DONE);
    given(datasetRepository.findByIdAndWorkspaceIdForUpdate(42L, 1L))
        .willReturn(Optional.of(dataset));
    CorpusIngestionDatasetStatusAdapter adapter =
        new CorpusIngestionDatasetStatusAdapter(datasetRepository);

    adapter.markIngestionTriggerFailed(1L, 42L);

    assertThat(dataset.getStatus()).isEqualTo(DatasetStatus.DONE);
    verify(datasetRepository, never()).save(dataset);
  }
}
