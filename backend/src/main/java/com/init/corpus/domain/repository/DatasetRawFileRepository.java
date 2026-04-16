package com.init.corpus.domain.repository;

import com.init.corpus.domain.model.DatasetRawFile;

public interface DatasetRawFileRepository {

  DatasetRawFile save(DatasetRawFile rawFile);
}
