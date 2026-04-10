package com.init.domainpack.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.init.domainpack.domain.model.WorkspaceMemberRole;
import com.init.domainpack.infrastructure.persistence.DomainPackWorkspaceMemberRef;
import com.init.domainpack.infrastructure.persistence.JpaDomainPackWorkspaceMembershipRepository;
import java.lang.reflect.Constructor;
import java.util.Set;
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
      "spring.datasource.url=jdbc:h2:mem:testdb-pack-membership;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.hibernate.ddl-auto=create-drop",
      "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect",
      "spring.jpa.properties.hibernate.hbm2ddl.create_namespaces=true",
      "spring.liquibase.enabled=false"
    })
@DisplayName("JpaDomainPackWorkspaceMembershipRepository")
class JpaDomainPackWorkspaceMembershipRepositoryTest {

  @Autowired private JpaDomainPackWorkspaceMembershipRepository repository;

  @Autowired private TestEntityManager em;

  @Test
  @DisplayName("hasAnyRole: 멤버가 OPERATOR 역할 보유 → true 반환")
  void should_true반환_when_OPERATOR역할보유() {
    // given
    createAndPersistMember(1L, 10L, WorkspaceMemberRole.OPERATOR.name());

    // when
    boolean result =
        repository.hasAnyRole(
            1L, 10L, Set.of(WorkspaceMemberRole.OPERATOR, WorkspaceMemberRole.ADMIN));

    // then
    assertThat(result).isTrue();
  }

  @Test
  @DisplayName("hasAnyRole: 멤버가 VIEWER 역할만 보유 → false 반환")
  void should_false반환_when_허용되지않은역할보유() {
    // given
    createAndPersistMember(1L, 20L, "VIEWER");

    // when
    boolean result =
        repository.hasAnyRole(
            1L, 20L, Set.of(WorkspaceMemberRole.OPERATOR, WorkspaceMemberRole.ADMIN));

    // then
    assertThat(result).isFalse();
  }

  @Test
  @DisplayName("hasAnyRole: 멤버 없음 → false 반환")
  void should_false반환_when_멤버없음() {
    // when
    boolean result = repository.hasAnyRole(999L, 999L, Set.of(WorkspaceMemberRole.OPERATOR));

    // then
    assertThat(result).isFalse();
  }

  @Test
  @DisplayName("hasAnyRole: memberRoles가 null → false 반환")
  void should_false반환_when_memberRoles가null() {
    // when
    boolean result = repository.hasAnyRole(999L, 999L, null);

    // then
    assertThat(result).isFalse();
  }

  @Test
  @DisplayName("hasAnyRole: memberRoles가 빈 Set → false 반환")
  void should_false반환_when_memberRoles가빈Set() {
    // when
    boolean result = repository.hasAnyRole(999L, 999L, Set.of());

    // then
    assertThat(result).isFalse();
  }

  // ── helper ─────────────────────────────────────────────────────────────────

  private DomainPackWorkspaceMemberRef createAndPersistMember(
      long workspaceId, long userId, String memberRole) {
    DomainPackWorkspaceMemberRef member = newMember();
    ReflectionTestUtils.setField(member, "workspaceId", workspaceId);
    ReflectionTestUtils.setField(member, "userId", userId);
    ReflectionTestUtils.setField(member, "memberRole", memberRole);
    em.persist(member);
    em.flush();
    return member;
  }

  private DomainPackWorkspaceMemberRef newMember() {
    try {
      Constructor<DomainPackWorkspaceMemberRef> ctor =
          DomainPackWorkspaceMemberRef.class.getDeclaredConstructor();
      ctor.setAccessible(true);
      return ctor.newInstance();
    } catch (ReflectiveOperationException e) {
      throw new RuntimeException(
          "failed to instantiate DomainPackWorkspaceMemberRef via reflection", e);
    }
  }
}
