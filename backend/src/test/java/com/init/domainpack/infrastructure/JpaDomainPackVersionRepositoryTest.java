package com.init.domainpack.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.init.domainpack.domain.model.DomainPack;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.infrastructure.persistence.JpaDomainPackVersionRepository;
import java.time.OffsetDateTime;
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
            .saveAndFlush(DomainPackVersion.createDraft(pack.getId(), 1, null, null, "{}", null));

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
            .saveAndFlush(DomainPackVersion.createDraft(pack.getId(), 1, null, null, "{}", null));

    // when — workspaceId=99L은 해당 pack의 workspaceId(1L)가 아님
    Optional<DomainPackVersion> result = repository.findByIdAndWorkspaceId(99L, version.getId());

    // then
    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("findCurrentPublishedByDomainPackId: DRAFT intent가 남은 PUBLISHED 버전은 제외")
  void should_excludePublishedVersionWithDraftIntent_when_findCurrentPublishedByDomainPackId() {
    DomainPack pack = DomainPack.create(1L, "refund-pack-3", "환불 Pack 3", null, null);
    em.persistAndFlush(pack);
    DomainPackVersion version = publishedVersion(pack.getId(), 1, "2026-05-22T13:40:00+09:00");
    em.persistAndFlush(version);
    em.persistAndFlush(intent(version.getId(), "REFUND", IntentDefinition.STATUS_DRAFT));

    Optional<DomainPackVersion> result =
        repository.findCurrentPublishedByDomainPackId(pack.getId());

    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("findCurrentPublishedByWorkspaceId: DRAFT intent가 없는 최신 PUBLISHED 버전만 운영 후보")
  void should_returnLatestDeployablePublishedVersion_when_findCurrentPublishedByWorkspaceId() {
    DomainPack invalidPack = DomainPack.create(1L, "invalid-pack", "미완료 Pack", null, null);
    DomainPack validPack = DomainPack.create(1L, "valid-pack", "완료 Pack", null, null);
    em.persist(invalidPack);
    em.persistAndFlush(validPack);

    DomainPackVersion invalidVersion =
        publishedVersion(invalidPack.getId(), 2, "2026-05-23T13:40:00+09:00");
    DomainPackVersion validVersion =
        publishedVersion(validPack.getId(), 1, "2026-05-22T13:40:00+09:00");
    em.persist(invalidVersion);
    em.persistAndFlush(validVersion);
    em.persistAndFlush(intent(invalidVersion.getId(), "INVALID", IntentDefinition.STATUS_DRAFT));
    em.persistAndFlush(intent(validVersion.getId(), "VALID", IntentDefinition.STATUS_PUBLISHED));

    Optional<DomainPackVersion> result = repository.findCurrentPublishedByWorkspaceId(1L);

    assertThat(result).isPresent();
    assertThat(result.get().getId()).isEqualTo(validVersion.getId());
  }

  private static DomainPackVersion publishedVersion(
      Long domainPackId, Integer versionNo, String publishedAt) {
    DomainPackVersion version =
        DomainPackVersion.createDraft(domainPackId, versionNo, null, null, "{}", null);
    version.activate(OffsetDateTime.parse(publishedAt));
    return version;
  }

  private static IntentDefinition intent(Long versionId, String code, String status) {
    IntentDefinition intent =
        IntentDefinition.create(versionId, code, code, null, 1, "{}", "{}", "[]", "{}");
    if (!IntentDefinition.STATUS_DRAFT.equals(status)) {
      intent.changeStatus(status);
    }
    return intent;
  }
}
