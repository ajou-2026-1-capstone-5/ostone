package com.init.workflowruntime.application.matching;

import com.init.workflowruntime.infrastructure.persistence.WorkflowMatchingProfileJdbcRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

@Component
public class WorkflowMatchingProfileCandidateProvider {

  private static final int MAX_CACHE_SIZE = 1_000;

  private final EmbeddingProperties properties;
  private final EmbeddingClient embeddingClient;
  private final WorkflowMatchingProfileJdbcRepository profileRepository;
  private final WorkflowMatchingTextSignals textSignals;
  private final Clock clock;
  private final Map<String, CachedEmbedding> queryEmbeddingCache = new ConcurrentHashMap<>();

  public WorkflowMatchingProfileCandidateProvider(
      EmbeddingProperties properties,
      EmbeddingClient embeddingClient,
      WorkflowMatchingProfileJdbcRepository profileRepository,
      WorkflowMatchingTextSignals textSignals,
      Clock clock) {
    this.properties = properties;
    this.embeddingClient = embeddingClient;
    this.profileRepository = profileRepository;
    this.textSignals = textSignals;
    this.clock = clock;
  }

  public boolean hasActiveProfiles(Long domainPackVersionId) {
    return profileRepository.countActiveProfiles(domainPackVersionId) > 0;
  }

  public List<WorkflowMatchingProfileCandidate> findCandidates(
      Long domainPackVersionId, String textHash, String redactedText) {
    String embeddingLiteral = VectorUtils.toVectorLiteral(queryEmbedding(textHash, redactedText));
    return profileRepository.findNearestActive(
        domainPackVersionId,
        embeddingLiteral,
        textSignals.lexicalSearchQuery(redactedText),
        properties.topKOrDefault());
  }

  private float[] queryEmbedding(String textHash, String redactedText) {
    Instant now = Instant.now(clock);
    CachedEmbedding cached = queryEmbeddingCache.get(textHash);
    if (cached != null && cached.expiresAt().isAfter(now)) {
      return cached.embedding();
    }
    float[] embedding = embeddingClient.embed(redactedText, EmbeddingInputType.SEARCH_QUERY);
    VectorUtils.requireCohereDimension(embedding);
    if (queryEmbeddingCache.size() > MAX_CACHE_SIZE) {
      queryEmbeddingCache.clear();
    }
    queryEmbeddingCache.put(
        textHash, new CachedEmbedding(embedding, now.plus(properties.queryCacheTtlOrDefault())));
    return embedding;
  }

  private static final class CachedEmbedding {
    private final float[] embedding;
    private final Instant expiresAt;

    private CachedEmbedding(float[] embedding, Instant expiresAt) {
      this.embedding = embedding;
      this.expiresAt = expiresAt;
    }

    private float[] embedding() {
      return embedding;
    }

    private Instant expiresAt() {
      return expiresAt;
    }
  }
}
