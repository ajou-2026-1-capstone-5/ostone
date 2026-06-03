package com.init.corpus.domain.repository;

import com.init.corpus.domain.model.Dataset;
import java.util.Optional;

public interface DatasetRepository {

  Dataset save(Dataset dataset);

  boolean existsByWorkspaceIdAndDatasetKey(Long workspaceId, String datasetKey);

  boolean existsByIdAndWorkspaceId(Long id, Long workspaceId);

  Optional<Dataset> findByIdAndWorkspaceId(Long id, Long workspaceId);

  /**
   * 비관적 쓰기 락을 걸고 데이터셋을 조회한다. presigned 업로드 complete의 동시 호출이 모두 {@code UPLOADING}을 읽고 각각 DAG를
   * 트리거하는 race를 막는다. 한쪽이 먼저 {@code PROCESSING} 전이를 커밋하면, 다른 쪽은 락 해제 후 재조회 시 {@code PROCESSING}을 보고
   * 멱등 분기로 빠져 재트리거하지 않는다.
   */
  Optional<Dataset> findByIdAndWorkspaceIdForUpdate(Long id, Long workspaceId);

  void deleteById(Long id);
}
