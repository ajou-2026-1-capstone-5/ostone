package com.init.domainpack.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.domainpack.application.GetIntentDefinitionListUseCase;
import com.init.domainpack.application.GetIntentDefinitionUseCase;
import com.init.domainpack.application.IntentDefinitionDetail;
import com.init.domainpack.application.IntentDefinitionSummary;
import com.init.domainpack.application.exception.DomainPackNotFoundException;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.application.exception.IntentDefinitionNotFoundException;
import com.init.fixtures.WithLongPrincipal;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    value = IntentDefinitionController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@DisplayName("IntentDefinitionController")
class IntentDefinitionControllerTest {

  private static final String BASE_URL = "/api/v1/workspaces/1/domain-packs/7/versions/101/intents";

  @Autowired private MockMvc mockMvc;

  @MockitoBean private GetIntentDefinitionListUseCase listUseCase;
  @MockitoBean private GetIntentDefinitionUseCase detailUseCase;

  @Test
  @DisplayName("GET .../intents → 200 OK, 목록 반환")
  @WithLongPrincipal(10L)
  void should_returnOkWithList_when_validRequest() throws Exception {
    // given
    given(listUseCase.execute(any()))
        .willReturn(
            List.of(
                new IntentDefinitionSummary(
                    1L,
                    "INTENT_001",
                    "배송 조회 문의",
                    "주문 배송 상태를 확인하려는 고객 의도",
                    1,
                    null,
                    "ACTIVE",
                    "{}",
                    OffsetDateTime.parse("2026-04-10T10:00:00Z"),
                    OffsetDateTime.parse("2026-04-10T10:00:00Z"))));

    // when & then
    mockMvc
        .perform(get(BASE_URL))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].intentCode").value("INTENT_001"))
        .andExpect(jsonPath("$[0].name").value("배송 조회 문의"))
        .andExpect(jsonPath("$[0].entryConditionJson").doesNotExist())
        .andExpect(jsonPath("$[0].evidenceJson").doesNotExist())
        .andExpect(jsonPath("$[0].metaJson").doesNotExist());
  }

  @Test
  @DisplayName("GET .../intents → intent 없으면 빈 배열")
  @WithLongPrincipal(10L)
  void should_returnEmptyArray_when_noIntentsExist() throws Exception {
    // given
    given(listUseCase.execute(any())).willReturn(List.of());

    // when & then
    mockMvc
        .perform(get(BASE_URL))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$").isArray())
        .andExpect(jsonPath("$").isEmpty());
  }

  @Test
  @DisplayName("GET .../intents/{id} → 200 OK, JSONB 필드 포함")
  @WithLongPrincipal(10L)
  void should_returnOkWithJsonbFields_when_intentExists() throws Exception {
    // given
    given(detailUseCase.execute(any()))
        .willReturn(
            new IntentDefinitionDetail(
                1L,
                "INTENT_001",
                "배송 조회 문의",
                "주문 배송 상태를 확인하려는 고객 의도",
                1,
                null,
                "ACTIVE",
                "{}",
                "{\"conditions\": []}",
                "[{\"turnId\": \"t-100\"}]",
                "{}",
                OffsetDateTime.parse("2026-04-10T10:00:00Z"),
                OffsetDateTime.parse("2026-04-10T10:00:00Z")));

    // when & then
    mockMvc
        .perform(get(BASE_URL + "/1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.intentCode").value("INTENT_001"))
        .andExpect(jsonPath("$.entryConditionJson").exists())
        .andExpect(jsonPath("$.evidenceJson").exists())
        .andExpect(jsonPath("$.metaJson").exists());
  }

  @Test
  @DisplayName("GET .../intents/{id} → 404 미존재")
  @WithLongPrincipal(10L)
  void should_return404_when_intentNotFound() throws Exception {
    // given
    given(detailUseCase.execute(any()))
        .willThrow(new IntentDefinitionNotFoundException(9999L, 101L));

    // when & then
    mockMvc
        .perform(get(BASE_URL + "/9999"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("INTENT_DEFINITION_NOT_FOUND"));
  }

  @Test
  @DisplayName("GET .../intents → 403 권한 없음")
  @WithLongPrincipal(10L)
  void should_return403_when_unauthorized() throws Exception {
    // given
    given(listUseCase.execute(any()))
        .willThrow(new DomainPackUnauthorizedWorkspaceAccessException("워크스페이스에 접근 권한이 없습니다."));

    // when & then
    mockMvc
        .perform(get(BASE_URL))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("GET .../intents → 401 미인증")
  void should_return401_when_unauthenticated() throws Exception {
    // when & then
    mockMvc.perform(get(BASE_URL)).andExpect(status().isUnauthorized());
  }

  @Test
  @DisplayName("GET .../intents → 404 version 소속 불일치")
  @WithLongPrincipal(10L)
  void should_return404_when_versionNotInPack() throws Exception {
    // given
    given(listUseCase.execute(any())).willThrow(new DomainPackVersionNotFoundException(101L));

    // when & then
    mockMvc
        .perform(get(BASE_URL))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("DOMAIN_PACK_VERSION_NOT_FOUND"));
  }

  @Test
  @DisplayName("GET .../intents → 404 존재하지 않는 packId")
  @WithLongPrincipal(10L)
  void should_return404_when_packNotFound() throws Exception {
    // given
    given(listUseCase.execute(any())).willThrow(new DomainPackNotFoundException(7L));

    // when & then
    mockMvc
        .perform(get(BASE_URL))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("DOMAIN_PACK_NOT_FOUND"));
  }
}
