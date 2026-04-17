package com.init.domainpack.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.domainpack.application.GetSlotDefinitionListUseCase;
import com.init.domainpack.application.GetSlotDefinitionUseCase;
import com.init.domainpack.application.SlotDefinitionResponse;
import com.init.domainpack.application.SlotDefinitionSummary;
import com.init.domainpack.application.exception.DomainPackNotFoundException;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.application.exception.SlotDefinitionNotFoundException;
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
    value = SlotDefinitionController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@DisplayName("SlotDefinitionController")
class SlotDefinitionControllerTest {

  private static final String BASE_URL =
      "/api/v1/workspaces/1/domain-packs/7/versions/101/slots";

  @Autowired private MockMvc mockMvc;

  @MockitoBean private GetSlotDefinitionListUseCase listUseCase;
  @MockitoBean private GetSlotDefinitionUseCase detailUseCase;

  @Test
  @DisplayName("GET .../slots → 200 OK, slot_code ASC 순 목록")
  @WithLongPrincipal(10L)
  void should_returnOkWithList_when_validRequest() throws Exception {
    // given
    given(listUseCase.execute(any()))
        .willReturn(
            List.of(
                new SlotDefinitionSummary(
                    1L,
                    101L,
                    "customer_name",
                    "고객명",
                    "상담 고객의 이름",
                    "STRING",
                    false,
                    "ACTIVE",
                    OffsetDateTime.parse("2026-04-10T10:00:00Z"),
                    OffsetDateTime.parse("2026-04-10T10:00:00Z"))));

    // when & then
    mockMvc
        .perform(get(BASE_URL))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].slotCode").value("customer_name"))
        .andExpect(jsonPath("$[0].name").value("고객명"))
        .andExpect(jsonPath("$[0].validationRuleJson").doesNotExist())
        .andExpect(jsonPath("$[0].defaultValueJson").doesNotExist())
        .andExpect(jsonPath("$[0].metaJson").doesNotExist());
  }

  @Test
  @DisplayName("GET .../slots → slot 없으면 빈 배열")
  @WithLongPrincipal(10L)
  void should_returnEmptyArray_when_noSlotsExist() throws Exception {
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
  @DisplayName("GET .../slots/{slotId} → 200 OK, validationRuleJson, defaultValueJson, metaJson 포함")
  @WithLongPrincipal(10L)
  void should_returnOkWithJsonFields_when_slotExists() throws Exception {
    // given
    given(detailUseCase.execute(any()))
        .willReturn(
            new SlotDefinitionResponse(
                1L,
                101L,
                "customer_name",
                "고객명",
                "상담 고객의 이름",
                "STRING",
                false,
                "{}",
                null,
                "{}",
                "ACTIVE",
                OffsetDateTime.parse("2026-04-10T10:00:00Z"),
                OffsetDateTime.parse("2026-04-10T10:00:00Z")));

    // when & then
    mockMvc
        .perform(get(BASE_URL + "/1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.slotCode").value("customer_name"))
        .andExpect(jsonPath("$.validationRuleJson").exists())
        .andExpect(jsonPath("$.metaJson").exists());
  }

  @Test
  @DisplayName("GET .../slots/{slotId} → 404 미존재")
  @WithLongPrincipal(10L)
  void should_return404_when_slotNotFound() throws Exception {
    // given
    given(detailUseCase.execute(any())).willThrow(new SlotDefinitionNotFoundException(9999L));

    // when & then
    mockMvc
        .perform(get(BASE_URL + "/9999"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("SLOT_DEFINITION_NOT_FOUND"));
  }

  @Test
  @DisplayName("GET .../slots → 403 권한 없음")
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
  @DisplayName("GET .../slots → 401 미인증")
  void should_return401_when_unauthenticated() throws Exception {
    // when & then
    mockMvc.perform(get(BASE_URL)).andExpect(status().isUnauthorized());
  }

  @Test
  @DisplayName("GET .../slots → 404 version 소속 불일치")
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
  @DisplayName("GET .../slots → 404 존재하지 않는 packId")
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

  @Test
  @DisplayName("GET .../slots/{slotId} → 404 다른 version 소속 slotId")
  @WithLongPrincipal(10L)
  void should_return404_when_slotBelongsToOtherVersion() throws Exception {
    // given
    given(detailUseCase.execute(any())).willThrow(new SlotDefinitionNotFoundException(1L));

    // when & then
    mockMvc
        .perform(get(BASE_URL + "/1"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("SLOT_DEFINITION_NOT_FOUND"));
  }
}
