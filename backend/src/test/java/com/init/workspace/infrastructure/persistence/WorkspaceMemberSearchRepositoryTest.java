package com.init.workspace.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("WorkspaceMemberSearchRepository")
class WorkspaceMemberSearchRepositoryTest {

  @Mock private EntityManager entityManager;
  @Mock private Query query;

  @Test
  @DisplayName("검색어의 LIKE 와일드카드를 리터럴로 escape")
  void should_escapeLikeWildcards_when_searchContainsSpecialChars() {
    given(entityManager.createNativeQuery(anyString())).willReturn(query);
    given(query.getResultList()).willReturn(List.of());
    WorkspaceMemberSearchRepository repository = new WorkspaceMemberSearchRepository(entityManager);

    repository.searchMembers(1L, " %_\\ ", null);

    ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
    verify(entityManager).createNativeQuery(sql.capture());
    assertThat(sql.getValue()).contains("escape");
    verify(query).setParameter("search", "%\\%\\_\\\\%");
  }
}
