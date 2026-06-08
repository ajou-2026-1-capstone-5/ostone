package com.init.testsupport;

import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

public final class PersistenceTestFixtures {

  private PersistenceTestFixtures() {}

  public static void assignGeneratedId(Object target, Long id) {
    setField(target, "id", id);
  }

  public static void setField(Object target, String fieldName, Object value) {
    if (target == null) {
      throw new IllegalArgumentException("target must not be null");
    }
    Field field = findField(target.getClass(), fieldName);
    try {
      field.setAccessible(true);
      field.set(target, value);
    } catch (IllegalAccessException e) {
      throw new IllegalStateException("Failed to set fixture field: " + fieldName, e);
    }
  }

  public static void invokeLifecycleCallback(Object target, String methodName) {
    if (target == null) {
      throw new IllegalArgumentException("target must not be null");
    }
    Method method = findMethod(target.getClass(), methodName);
    try {
      method.setAccessible(true);
      method.invoke(target);
    } catch (IllegalAccessException e) {
      throw new IllegalStateException("Failed to invoke fixture callback: " + methodName, e);
    } catch (InvocationTargetException e) {
      Throwable cause = e.getCause();
      if (cause instanceof RuntimeException runtimeException) {
        throw runtimeException;
      }
      if (cause instanceof Error error) {
        throw error;
      }
      throw new IllegalStateException("Fixture callback failed: " + methodName, cause);
    }
  }

  private static Field findField(Class<?> type, String fieldName) {
    Class<?> current = type;
    while (current != null) {
      try {
        return current.getDeclaredField(fieldName);
      } catch (NoSuchFieldException ignored) {
        current = current.getSuperclass();
      }
    }
    throw new IllegalArgumentException("No field named " + fieldName + " on " + type.getName());
  }

  private static Method findMethod(Class<?> type, String methodName) {
    Class<?> current = type;
    while (current != null) {
      try {
        return current.getDeclaredMethod(methodName);
      } catch (NoSuchMethodException ignored) {
        current = current.getSuperclass();
      }
    }
    throw new IllegalArgumentException("No method named " + methodName + " on " + type.getName());
  }
}
