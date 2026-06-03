package com.init.corpus.infrastructure.persistence;

import com.init.corpus.domain.model.Dataset;
import com.init.corpus.domain.repository.DatasetRepository;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaDatasetRepository extends JpaRepository<Dataset, Long>, DatasetRepository {

  @Override
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select d from Dataset d where d.id = :id and d.workspaceId = :workspaceId")
  Optional<Dataset> findByIdAndWorkspaceIdForUpdate(
      @Param("id") Long id, @Param("workspaceId") Long workspaceId);
}
