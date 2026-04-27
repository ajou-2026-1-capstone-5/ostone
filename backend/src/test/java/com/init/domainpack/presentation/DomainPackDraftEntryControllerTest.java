package com.init.domainpack.presentation;

import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.domainpack.application.DomainPackDraftEntryResult;
import com.init.domainpack.application.GetDomainPackDraftEntryQuery;
import com.init.domainpack.application.GetDomainPackDraftEntryUseCase;
import com.init.domainpack.application.exception.DomainPackDraftEntryNotFoundException;
import com.init.fixtures.WithLongPrincipal;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    value = DomainPackDraftEntryController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@DisplayName("DomainPackDraftEntryController")
class DomainPackDraftEntryControllerTest {

  private static final String URL = "/api/v1/workspaces/1/domain-packs/draft-entry";

  @Autowired private MockMvc mockMvc;

  @MockitoBean private GetDomainPackDraftEntryUseCase useCase;

  @Test
  @DisplayName("GET draft-entry → 200 OK, 최신 draft entry 반환")
  @WithLongPrincipal(10L)
  void shouldReturnDraftEntryWhenExists() throws Exception {
    given(
            useCase.execute(
                argThat(query -> query.workspaceId().equals(1L) && query.userId().equals(10L))))
        .willReturn(new DomainPackDraftEntryResult(1L, 7L, 101L, "CS 정책팩", 3));

    mockMvc
        .perform(get(URL))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.workspaceId").value(1))
        .andExpect(jsonPath("$.packId").value(7))
        .andExpect(jsonPath("$.versionId").value(101))
        .andExpect(jsonPath("$.packName").value("CS 정책팩"))
        .andExpect(jsonPath("$.versionNo").value(3));

    verify(useCase)
        .execute(argThat(query -> query.workspaceId().equals(1L) && query.userId().equals(10L)));
  }

  @Test
  @DisplayName("GET draft-entry → draft가 없으면 404")
  @WithLongPrincipal(10L)
  void shouldReturnNotFoundWhenDraftEntryMissing() throws Exception {
    given(useCase.execute(new GetDomainPackDraftEntryQuery(1L, 10L)))
        .willThrow(new DomainPackDraftEntryNotFoundException(1L));

    mockMvc
        .perform(get(URL))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("DOMAIN_PACK_DRAFT_ENTRY_NOT_FOUND"));
  }

  @Test
  @DisplayName("GET draft-entry → 미인증이면 401")
  void shouldReturnUnauthorizedWithoutPrincipal() throws Exception {
    mockMvc.perform(get(URL)).andExpect(status().isUnauthorized());
  }
}
