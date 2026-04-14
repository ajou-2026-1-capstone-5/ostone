package com.init.workspace.presentation.dto;

import com.fasterxml.jackson.annotation.JsonSetter;

public class UpdateWorkspaceRequest {

  private boolean nameProvided;
  private String name;
  private boolean descriptionProvided;
  private String description;

  public boolean isNameProvided() {
    return nameProvided;
  }

  public String getName() {
    return name;
  }

  public boolean isDescriptionProvided() {
    return descriptionProvided;
  }

  public String getDescription() {
    return description;
  }

  @JsonSetter("name")
  public void setName(String name) {
    this.nameProvided = true;
    this.name = name;
  }

  @JsonSetter("description")
  public void setDescription(String description) {
    this.descriptionProvided = true;
    this.description = description;
  }
}
