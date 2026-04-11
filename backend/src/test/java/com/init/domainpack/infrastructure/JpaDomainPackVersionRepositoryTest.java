package com.init.domainpack.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.infrastructure.persistence.DomainPackRef;
import com.init.domainpack.infrastructure.persistence.JpaDomainPackVersionRepository;
import java.lang.reflect.Constructor;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.util.ReflectionTestUtils;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:testdb-pack-version;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.hibernate.ddl-auto=create-drop",
      "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect",
      "spring.jpa.properties.hibernate.hbm2ddl.create_namespaces=true",
      "spring.liquibase.enabled=false"
    })
@DisplayName("JpaDomainPackVersionRepository")
class JpaDomainPackVersionRepositoryTest {

  @Autowired private JpaDomainPackVersionRepository repository;

  @Autowired private TestEntityManager em;

  @Test
  @DisplayName("findByIdAndWorkspaceId: 올바른 workspaceId + versionId → version 반환")
  void should_version반환_when_올바른workspaceId와versionId() {
    // given
    DomainPackRef pack = newRef();
    ReflectionTestUtils.setField(pack, "id", 1L);
    ReflectionTestUtils.setField(pack, "workspaceId", 1L);
    em.persist(pack);

    DomainPackVersion version = newVersion();
    ReflectionTestUtils.setField(version, "domainPackId", 1L);
    ReflectionTestUtils.setField(version, "versionNo", 1);
    ReflectionTestUtils.setField(version, "lifecycleStatus", "DRAFT");
    ReflectionTestUtils.setField(version, "summaryJson", "{}");
    ReflectionTestUtils.setField(version, "createdAt", OffsetDateTime.now());
    ReflectionTestUtils.setField(version, "updatedAt", OffsetDateTime.now());
    em.persist(version);
    em.flush();

    // when
    Optional<DomainPackVersion> result = repository.findByIdAndWorkspaceId(1L, version.getId());

    // then
    assertThat(result).isPresent();
    assertThat(result.get().getId()).isEqualTo(version.getId());
  }

  @Test
  @DisplayName("findByIdAndWorkspaceId: 다른 workspaceId → empty 반환")
  void should_empty반환_when_다른workspaceId() {
    // given
    DomainPackRef pack = newRef();
    ReflectionTestUtils.setField(pack, "id", 2L);
    ReflectionTestUtils.setField(pack, "workspaceId", 1L);
    em.persist(pack);

    DomainPackVersion version = newVersion();
    ReflectionTestUtils.setField(version, "domainPackId", 2L);
    ReflectionTestUtils.setField(version, "versionNo", 1);
    ReflectionTestUtils.setField(version, "lifecycleStatus", "DRAFT");
    ReflectionTestUtils.setField(version, "summaryJson", "{}");
    ReflectionTestUtils.setField(version, "createdAt", OffsetDateTime.now());
    ReflectionTestUtils.setField(version, "updatedAt", OffsetDateTime.now());
    em.persist(version);
    em.flush();

    // when — workspaceId=99L은 해당 pack의 workspaceId(1L)가 아님
    Optional<DomainPackVersion> result = repository.findByIdAndWorkspaceId(99L, version.getId());

    // then
    assertThat(result).isEmpty();
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private DomainPackRef newRef() {
    try {
      Constructor<DomainPackRef> ctor = DomainPackRef.class.getDeclaredConstructor();
      ctor.setAccessible(true);
      return ctor.newInstance();
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }

  private DomainPackVersion newVersion() {
    try {
      Constructor<DomainPackVersion> ctor = DomainPackVersion.class.getDeclaredConstructor();
      ctor.setAccessible(true);
      return ctor.newInstance();
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }
}
