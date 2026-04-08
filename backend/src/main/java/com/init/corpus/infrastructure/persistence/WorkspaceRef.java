package com.init.corpus.infrastructure.persistence;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "workspace", schema = "app")
public class WorkspaceRef {

  @Id private Long id;

  protected WorkspaceRef() {}

  public Long getId() {
    return id;
  }
}
