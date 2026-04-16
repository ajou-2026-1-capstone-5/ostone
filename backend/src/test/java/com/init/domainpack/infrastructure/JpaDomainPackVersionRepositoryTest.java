package com.init.domainpack.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.init.domainpack.domain.model.DomainPack;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.infrastructure.persistence.JpaDomainPackVersionRepository;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.TestPropertySource;

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
    DomainPack pack = DomainPack.create(1L, "refund-pack-1", "환불 Pack 1", null, null);
    em.persistAndFlush(pack);

    DomainPackVersion version =
        ((DomainPackVersionRepository) repository)
            .saveAndFlush(DomainPackVersion.createDraft(pack.getId(), 1, null, null, "{}"));

    // when
    Optional<DomainPackVersion> result = repository.findByIdAndWorkspaceId(1L, version.getId());

    // then
    assertThat(result).isPresent();
    assertThat(result.get().getId()).isEqualTo(version.getId());
    assertThat(result.get().getCreatedAt()).isNotNull();
  }

  @Test
  @DisplayName("findByIdAndWorkspaceId: 다른 workspaceId → empty 반환")
  void should_empty반환_when_다른workspaceId() {
    // given
    DomainPack pack = DomainPack.create(1L, "refund-pack-2", "환불 Pack 2", null, null);
    em.persistAndFlush(pack);

    DomainPackVersion version =
        ((DomainPackVersionRepository) repository)
            .saveAndFlush(DomainPackVersion.createDraft(pack.getId(), 1, null, null, "{}"));

    // when — workspaceId=99L은 해당 pack의 workspaceId(1L)가 아님
    Optional<DomainPackVersion> result = repository.findByIdAndWorkspaceId(99L, version.getId());

    // then
    assertThat(result).isEmpty();
  }
}
