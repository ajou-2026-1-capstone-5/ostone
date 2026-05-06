package com.init.domainpack.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("DomainPackVersionPortAdapter")
class DomainPackVersionPortAdapterTest {

  @Mock private DomainPackVersionRepository domainPackVersionRepository;
  @Mock private DomainPackRepository domainPackRepository;

  private DomainPackVersionPortAdapter adapter;

  @BeforeEach
  void setUp() {
    adapter = new DomainPackVersionPortAdapter(domainPackVersionRepository, domainPackRepository);
  }

  @Test
  @DisplayName("findDomainPackIdByVersionId — 버전이 존재하면 domainPackId를 반환한다")
  void findDomainPackIdByVersionId_exists_returnsDomainPackId() {
    DomainPackVersion version = newVersion(101L, 7L);
    given(domainPackVersionRepository.findById(101L)).willReturn(Optional.of(version));

    Optional<Long> result = adapter.findDomainPackIdByVersionId(101L);

    assertThat(result).contains(7L);
  }

  @Test
  @DisplayName("findDomainPackIdByVersionId — 버전이 없으면 Optional.empty를 반환한다")
  void findDomainPackIdByVersionId_absent_returnsEmpty() {
    given(domainPackVersionRepository.findById(999L)).willReturn(Optional.empty());

    Optional<Long> result = adapter.findDomainPackIdByVersionId(999L);

    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("existsByDomainPackIdAndWorkspaceId — 존재하면 true를 반환한다")
  void existsByDomainPackIdAndWorkspaceId_exists_returnsTrue() {
    given(domainPackRepository.existsByIdAndWorkspaceId(7L, 3L)).willReturn(true);

    boolean result = adapter.existsByDomainPackIdAndWorkspaceId(7L, 3L);

    assertThat(result).isTrue();
  }

  @Test
  @DisplayName("existsByDomainPackIdAndWorkspaceId — 존재하지 않으면 false를 반환한다")
  void existsByDomainPackIdAndWorkspaceId_absent_returnsFalse() {
    given(domainPackRepository.existsByIdAndWorkspaceId(7L, 99L)).willReturn(false);

    boolean result = adapter.existsByDomainPackIdAndWorkspaceId(7L, 99L);

    assertThat(result).isFalse();
  }

  private DomainPackVersion newVersion(Long versionId, Long domainPackId) {
    try {
      var constructor = DomainPackVersion.class.getDeclaredConstructor();
      constructor.setAccessible(true);
      DomainPackVersion version = constructor.newInstance();
      ReflectionTestUtils.setField(version, "id", versionId);
      ReflectionTestUtils.setField(version, "domainPackId", domainPackId);
      return version;
    } catch (ReflectiveOperationException ex) {
      throw new RuntimeException("DomainPackVersion 테스트 인스턴스 생성 실패", ex);
    }
  }
}
