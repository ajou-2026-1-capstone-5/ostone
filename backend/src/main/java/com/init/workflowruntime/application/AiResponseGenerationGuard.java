package com.init.workflowruntime.application;

import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.Semaphore;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.stereotype.Component;

@Component
public class AiResponseGenerationGuard {

  public static final String IN_PROGRESS_CODE = "AI_RESPONSE_IN_PROGRESS";
  public static final String IN_PROGRESS_MESSAGE = "AI 응답 생성 중입니다. 잠시 후 다시 시도해 주세요.";

  private final ConcurrentMap<Long, SessionGate> sessionGates = new ConcurrentHashMap<>();

  public Optional<Lease> tryEnter(Long sessionId) {
    SessionGate gate =
        sessionGates.compute(
            sessionId,
            (ignored, existing) -> {
              SessionGate next = existing == null ? new SessionGate() : existing;
              next.retain();
              return next;
            });
    if (!gate.tryAcquire()) {
      releaseReference(sessionId, gate);
      return Optional.empty();
    }
    return Optional.of(new Lease(sessionId, gate, this));
  }

  private void release(Long sessionId, SessionGate gate) {
    gate.release();
    releaseReference(sessionId, gate);
  }

  private void releaseReference(Long sessionId, SessionGate gate) {
    gate.releaseReference();
    sessionGates.computeIfPresent(
        sessionId, (ignored, existing) -> existing == gate && gate.canRemove() ? null : existing);
  }

  private static final class SessionGate {
    private final Semaphore semaphore = new Semaphore(1);
    private final AtomicInteger references = new AtomicInteger();

    void retain() {
      references.incrementAndGet();
    }

    boolean tryAcquire() {
      return semaphore.tryAcquire();
    }

    void release() {
      semaphore.release();
    }

    void releaseReference() {
      references.decrementAndGet();
    }

    boolean canRemove() {
      return references.get() == 0 && semaphore.availablePermits() == 1;
    }
  }

  public static final class Lease implements AutoCloseable {
    private final Long sessionId;
    private final SessionGate gate;
    private final AiResponseGenerationGuard owner;
    private boolean closed;

    private Lease(Long sessionId, SessionGate gate, AiResponseGenerationGuard owner) {
      this.sessionId = sessionId;
      this.gate = gate;
      this.owner = owner;
    }

    @Override
    public void close() {
      if (closed) {
        return;
      }
      closed = true;
      owner.release(sessionId, gate);
    }
  }
}
