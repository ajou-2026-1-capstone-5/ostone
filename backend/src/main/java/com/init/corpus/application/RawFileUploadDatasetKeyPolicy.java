package com.init.corpus.application;

import java.util.regex.Pattern;

public final class RawFileUploadDatasetKeyPolicy {

  public static final String SAFE_OBJECT_KEY_SEGMENT_REGEXP = "^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$";
  public static final String SAFE_OBJECT_KEY_SEGMENT_DESCRIPTION =
      "datasetKey must match ^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$";

  private static final Pattern SAFE_OBJECT_KEY_SEGMENT_PATTERN =
      Pattern.compile(SAFE_OBJECT_KEY_SEGMENT_REGEXP);

  private RawFileUploadDatasetKeyPolicy() {}

  public static boolean isSafeObjectKeySegment(String value) {
    return value != null && SAFE_OBJECT_KEY_SEGMENT_PATTERN.matcher(value).matches();
  }
}
