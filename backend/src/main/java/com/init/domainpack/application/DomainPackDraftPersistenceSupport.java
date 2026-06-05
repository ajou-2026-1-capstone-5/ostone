package com.init.domainpack.application;

import com.init.domainpack.application.exception.DomainPackDraftRequestInvalidException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;

final class DomainPackDraftPersistenceSupport {

  private DomainPackDraftPersistenceSupport() {}

  static <T> List<T> safeList(List<T> list) {
    return list == null ? List.of() : list;
  }

  static <T> void ensureUnique(List<T> items, Function<T, String> keyExtractor, String fieldName) {
    Map<String, Boolean> seen = new LinkedHashMap<>();
    for (T item : items) {
      String key = keyExtractor.apply(item);
      if (key == null || key.isBlank()) {
        throw new DomainPackDraftRequestInvalidException(fieldName + "는 비어 있을 수 없습니다.");
      }
      if (seen.put(key, Boolean.TRUE) != null) {
        throw new DomainPackDraftRequestInvalidException(
            "중복된 " + fieldName + " 값이 존재합니다. value=" + key);
      }
    }
  }

  static <T> Map<String, T> indexByCode(List<T> items, Function<T, String> codeExtractor) {
    Map<String, T> indexed = new LinkedHashMap<>();
    for (T item : items) {
      indexed.put(codeExtractor.apply(item), item);
    }
    return indexed;
  }

  static <T> T requireByCode(Map<String, T> indexed, String code, String resourceName) {
    T resource = indexed.get(code);
    if (resource == null) {
      throw new DomainPackDraftRequestInvalidException(
          resourceName + " 참조를 찾을 수 없습니다. code=" + Objects.toString(code));
    }
    return resource;
  }
}
