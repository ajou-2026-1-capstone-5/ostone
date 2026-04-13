package com.init.workspace.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.util.Objects;
import java.util.regex.Pattern;

@Embeddable
public class WorkspaceKey {

  private static final int MIN_LENGTH = 3;
  private static final int MAX_LENGTH = 100;
  private static final Pattern PATTERN =
      Pattern.compile("^[a-z0-9]([a-z0-9-]*[a-z0-9])?$");

  @Column(name = "workspace_key", nullable = false, unique = true, length = 100)
  private String value;

  protected WorkspaceKey() {}

  private WorkspaceKey(String value) {
    validate(value);
    this.value = value;
  }

  public static WorkspaceKey of(String value) {
    return new WorkspaceKey(value);
  }

  public String getValue() {
    return value;
  }

  private static void validate(String value) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException("workspaceKey must not be null or blank");
    }
    if (value.length() < MIN_LENGTH || value.length() > MAX_LENGTH) {
      throw new IllegalArgumentException(
          "workspaceKey length must be between " + MIN_LENGTH + " and " + MAX_LENGTH);
    }
    if (!PATTERN.matcher(value).matches()) {
      throw new IllegalArgumentException(
          "workspaceKey must match pattern " + PATTERN.pattern());
    }
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (!(o instanceof WorkspaceKey that)) {
      return false;
    }
    return Objects.equals(value, that.value);
  }

  @Override
  public int hashCode() {
    return Objects.hash(value);
  }
}
