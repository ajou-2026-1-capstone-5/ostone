package com.init.workspace.infrastructure.persistence;

import static com.init.shared.infrastructure.persistence.NativeQueryColumnConverter.toLong;
import static com.init.shared.infrastructure.persistence.NativeQueryColumnConverter.toOffsetDateTime;

import com.init.workspace.application.WorkspaceMemberListEntry;
import com.init.workspace.application.WorkspaceMemberSearchPort;
import com.init.workspace.domain.model.WorkspaceMemberRole;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import org.springframework.stereotype.Repository;

@Repository
public class WorkspaceMemberSearchRepository implements WorkspaceMemberSearchPort {

  private final EntityManager entityManager;

  public WorkspaceMemberSearchRepository(EntityManager entityManager) {
    this.entityManager = entityManager;
  }

  @Override
  public List<WorkspaceMemberListEntry> searchMembers(
      Long workspaceId, String search, WorkspaceMemberRole role) {
    String normalizedSearch = normalizeSearch(search);
    Query query = entityManager.createNativeQuery(buildQuery(normalizedSearch, role));
    query.setParameter("workspaceId", workspaceId);
    if (normalizedSearch != null) {
      query.setParameter("search", "%" + normalizedSearch + "%");
    }
    if (role != null) {
      query.setParameter("role", role.name());
    }

    @SuppressWarnings("unchecked")
    List<Object[]> rows = query.getResultList();
    return rows.stream().map(this::toEntry).toList();
  }

  private String buildQuery(String normalizedSearch, WorkspaceMemberRole role) {
    StringBuilder query =
        new StringBuilder(
            """
            select
              wm.id as member_id,
              wm.user_id,
              au.name,
              au.email,
              wm.member_role,
              wm.joined_at,
              au.status
            from app.workspace_member wm
            join app.app_user au on au.id = wm.user_id
            where wm.workspace_id = :workspaceId
            """);
    if (normalizedSearch != null) {
      query.append(
          """
            and (
              lower(au.name) like :search escape '\\'
              or lower(au.email) like :search escape '\\'
            )
          """);
    }
    if (role != null) {
      query.append("""
            and wm.member_role = :role
          """);
    }
    query.append(" order by wm.joined_at asc, wm.id asc");
    return query.toString();
  }

  private String normalizeSearch(String search) {
    if (search == null || search.isBlank()) {
      return null;
    }
    return search
        .trim()
        .toLowerCase(Locale.ROOT)
        .replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_");
  }

  private WorkspaceMemberListEntry toEntry(Object[] row) {
    return new WorkspaceMemberListEntry(
        toLong(row[0]),
        toLong(row[1]),
        Objects.toString(row[2], null),
        Objects.toString(row[3], null),
        Objects.toString(row[4], null),
        toOffsetDateTime(row[5]),
        Objects.toString(row[6], null));
  }
}
