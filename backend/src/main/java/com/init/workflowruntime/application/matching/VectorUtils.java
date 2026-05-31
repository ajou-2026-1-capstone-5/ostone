package com.init.workflowruntime.application.matching;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

public final class VectorUtils {

  public static final int COHERE_EMBEDDING_DIMENSION = 1024;

  private VectorUtils() {}

  public static void requireCohereDimension(float[] vector) {
    if (vector == null || vector.length != COHERE_EMBEDDING_DIMENSION) {
      throw new IllegalStateException(
          "Embedding dimension must be "
              + COHERE_EMBEDDING_DIMENSION
              + " but was "
              + (vector == null ? 0 : vector.length));
    }
  }

  public static String toVectorLiteral(float[] vector) {
    requireCohereDimension(vector);
    StringBuilder builder = new StringBuilder("[");
    for (int i = 0; i < vector.length; i++) {
      if (i > 0) {
        builder.append(',');
      }
      builder.append(Float.toString(vector[i]));
    }
    return builder.append(']').toString();
  }

  public static String sha256(String value) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      return HexFormat.of()
          .formatHex(digest.digest((value == null ? "" : value).getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 algorithm is unavailable", e);
    }
  }

  public static double clamp01(double value) {
    if (Double.isNaN(value) || Double.isInfinite(value)) {
      return 0.0;
    }
    return Math.max(0.0, Math.min(1.0, value));
  }
}
