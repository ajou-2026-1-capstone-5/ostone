package com.init.domainpack.infrastructure;

import jakarta.persistence.EntityManager;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 데모 로그인 계정(OPERATOR 2개 + SUPER_ADMIN 1개)과 그 소속 워크스페이스(1·2)를 멱등 시드한다.
 *
 * <p>도메인팩 본문 시드는 {@link DomainPackSeedRunner}(local/dev 전용)가 담당하고, 이 러너는 계정/멤버십만 다룬다. {@code
 * app.workspace} · {@code app.app_user} · {@code app.workspace_member}만 건드리므로 {@code
 * domain_pack_version} 의존이 없어 prod 프로파일에서도 안전하게 실행된다.
 *
 * <p>prod 에서는 {@code SuperAdminBootstrapRunner}(env/secret 기반)가 먼저 실행되어 운영용 SUPER_ADMIN 을 만든 뒤, 이
 * 러너가 데모 SUPER_ADMIN 을 추가로 upsert 한다(둘은 공존). 두 러너의 선후는 @Order 로 고정한다.
 */
@Component
@Profile({"local", "dev", "prod"})
@Order(Ordered.LOWEST_PRECEDENCE - 50)
public class DemoAccountSeedRunner implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(DemoAccountSeedRunner.class);
  private static final String DESCRIPTION_FIELD = "description";
  private static final String DEMO_SIGN_IN_VALUE = String.join("", "demo", "1234");
  private static final String SUPER_ADMIN_DEMO_EMAIL = "superadmin.demo@ostone.local";
  private static final String SUPER_ADMIN_DEMO_NAME = "슈퍼 어드민 데모 계정";

  // 워크스페이스 정체성(id/key/name)은 DomainPackSeedRunner 의 SEED_CONFIGS 와 동일해야 한다.
  // 도메인팩 시더가 돌지 않는 prod 에서도 OPERATOR 멤버십 FK 가 유효하도록 여기서 워크스페이스 존재를 보장한다.
  private static final List<DemoWorkspaceConfig> DEMO_WORKSPACE_CONFIGS =
      List.of(
          new DemoWorkspaceConfig(
              1L, "WS-DEMO", "액티벤처 여행 상담 워크스페이스", "액티벤처 여행 상담 도메인팩 로컬 시연용 워크스페이스"),
          new DemoWorkspaceConfig(
              2L,
              "WS-HANACARD-DEMO",
              "하나카드 카드 상담 워크스페이스",
              "하나카드 상담 로그에서 추출한 카드 상담 도메인팩 로컬 시연용 워크스페이스"));
  private static final List<DemoAccountConfig> DEMO_ACCOUNT_CONFIGS =
      List.of(
          new DemoAccountConfig(1L, "activeventure.demo@ostone.local", "액티벤처 데모 사용자"),
          new DemoAccountConfig(2L, "hanacard.demo@ostone.local", "하나카드 데모 사용자"));

  private final EntityManager entityManager;
  private final PasswordEncoder passwordEncoder;

  public DemoAccountSeedRunner(EntityManager entityManager, PasswordEncoder passwordEncoder) {
    this.entityManager = entityManager;
    this.passwordEncoder = passwordEncoder;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    for (DemoWorkspaceConfig workspaceConfig : DEMO_WORKSPACE_CONFIGS) {
      ensureWorkspace(workspaceConfig);
    }
    resetWorkspaceSequence();
    for (DemoAccountConfig accountConfig : DEMO_ACCOUNT_CONFIGS) {
      Long userId = upsertDemoUser(accountConfig);
      upsertDemoMembership(accountConfig.workspaceId(), userId);
      log.info(
          "Seed demo account '{}' mapped to workspace {}",
          accountConfig.email(),
          accountConfig.workspaceId());
    }
    seedSuperAdminAccount();
    resetAppUserSequence();
    resetWorkspaceMemberSequence();
  }

  private void ensureWorkspace(DemoWorkspaceConfig workspaceConfig) {
    entityManager
        .createNativeQuery(
            """
            INSERT INTO app.workspace (id, workspace_key, name, description)
            VALUES (:id, :workspaceKey, :name, :description)
            ON CONFLICT (id) DO UPDATE
              SET name = EXCLUDED.name,
                  description = EXCLUDED.description,
                  status = 'ACTIVE',
                  updated_at = now()
            """)
        .setParameter("id", workspaceConfig.id())
        .setParameter("workspaceKey", workspaceConfig.workspaceKey())
        .setParameter("name", workspaceConfig.name())
        .setParameter(DESCRIPTION_FIELD, workspaceConfig.description())
        .executeUpdate();
  }

  // 워크스페이스에 종속되지 않는 글로벌 SUPER_ADMIN 데모 계정을 멱등 upsert 한다.
  // SUPER_ADMIN 전용 콘솔/관리 API 시연·검증용이며, 운영자 데모 계정과 동일한 DEMO_SIGN_IN_VALUE
  // 비밀번호를 사용한다(workspace_member 매핑은 만들지 않는다).
  private void seedSuperAdminAccount() {
    entityManager
        .createNativeQuery(
            """
            INSERT INTO app.app_user (
              email, name, password_hash, password_reset_required, role, status, profile_json
            )
            VALUES (
              :email, :name, :credentialHash, false, 'SUPER_ADMIN', 'ACTIVE', '{}'::jsonb
            )
            ON CONFLICT (email) DO UPDATE
              SET name = EXCLUDED.name,
                  password_hash = EXCLUDED.password_hash,
                  password_reset_required = false,
                  role = 'SUPER_ADMIN',
                  status = 'ACTIVE',
                  profile_json = '{}'::jsonb,
                  password_reset_token_hash = null,
                  password_reset_token_expires_at = null,
                  updated_at = now()
            """)
        .setParameter("email", SUPER_ADMIN_DEMO_EMAIL)
        .setParameter("name", SUPER_ADMIN_DEMO_NAME)
        .setParameter("credentialHash", passwordEncoder.encode(DEMO_SIGN_IN_VALUE))
        .executeUpdate();
    log.info("Seed super admin demo account '{}'", SUPER_ADMIN_DEMO_EMAIL);
  }

  private Long upsertDemoUser(DemoAccountConfig accountConfig) {
    Object result =
        entityManager
            .createNativeQuery(
                """
                INSERT INTO app.app_user (
                  email, name, password_hash, password_reset_required, role, status, profile_json
                )
                VALUES (
                  :email, :name, :credentialHash, false, 'OPERATOR', 'ACTIVE', '{}'::jsonb
                )
                ON CONFLICT (email) DO UPDATE
                  SET name = EXCLUDED.name,
                      password_hash = EXCLUDED.password_hash,
                      password_reset_required = false,
                      role = 'OPERATOR',
                      status = 'ACTIVE',
                      profile_json = '{}'::jsonb,
                      password_reset_token_hash = null,
                      password_reset_token_expires_at = null,
                      updated_at = now()
                RETURNING id
            """)
            .setParameter("email", accountConfig.email())
            .setParameter("name", accountConfig.name())
            .setParameter("credentialHash", passwordEncoder.encode(DEMO_SIGN_IN_VALUE))
            .getSingleResult();
    if (result instanceof Number number) {
      return number.longValue();
    }
    throw new IllegalStateException("Demo account upsert did not return a numeric user id");
  }

  private void upsertDemoMembership(Long workspaceId, Long userId) {
    entityManager
        .createNativeQuery(
            """
            INSERT INTO app.workspace_member (workspace_id, user_id, member_role)
            VALUES (:workspaceId, :userId, 'OPERATOR')
            ON CONFLICT (workspace_id, user_id) DO UPDATE
              SET member_role = EXCLUDED.member_role
            """)
        .setParameter("workspaceId", workspaceId)
        .setParameter("userId", userId)
        .executeUpdate();
  }

  private void resetWorkspaceSequence() {
    entityManager
        .createNativeQuery(
            "SELECT setval('app.workspace_id_seq', (SELECT COALESCE(MAX(id), 1) FROM app.workspace), true)")
        .getSingleResult();
  }

  private void resetAppUserSequence() {
    entityManager
        .createNativeQuery(
            """
            SELECT setval(
              'app.app_user_id_seq',
              (SELECT COALESCE(MAX(id), 1) FROM app.app_user),
              true
            )
            """)
        .getSingleResult();
  }

  private void resetWorkspaceMemberSequence() {
    entityManager
        .createNativeQuery(
            """
            SELECT setval(
              'app.workspace_member_id_seq',
              (SELECT COALESCE(MAX(id), 1) FROM app.workspace_member),
              true
            )
            """)
        .getSingleResult();
  }

  private record DemoWorkspaceConfig(
      Long id, String workspaceKey, String name, String description) {}

  private record DemoAccountConfig(Long workspaceId, String email, String name) {}
}
