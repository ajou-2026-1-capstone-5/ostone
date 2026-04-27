package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.init.domainpack.application.exception.DomainPackDraftEntryNotFoundException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.domainpack.domain.repository.DomainPackDraftEntryRow;
import com.init.domainpack.domain.repository.DomainPackRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("GetDomainPackDraftEntryUseCase")
class GetDomainPackDraftEntryUseCaseTest {

  private static final Long WORKSPACE_ID = 1L;
  private static final Long USER_ID = 10L;

  @Mock private DomainPackValidator validator;
  @Mock private DomainPackRepository domainPackRepository;

  private GetDomainPackDraftEntryUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase = new GetDomainPackDraftEntryUseCase(validator, domainPackRepository);
  }

  @Test
  @DisplayName("접근 가능한 workspace의 최신 DRAFT domain pack entry를 반환한다")
  void shouldReturnLatestDraftEntryWhenExists() {
    given(domainPackRepository.findLatestDraftEntryByWorkspaceId(WORKSPACE_ID))
        .willReturn(Optional.of(new StubDraftEntryRow()));

    DomainPackDraftEntryResult result =
        useCase.execute(new GetDomainPackDraftEntryQuery(WORKSPACE_ID, USER_ID));

    assertThat(result.workspaceId()).isEqualTo(WORKSPACE_ID);
    assertThat(result.packId()).isEqualTo(7L);
    assertThat(result.versionId()).isEqualTo(101L);
    assertThat(result.packName()).isEqualTo("CS 정책팩");
    assertThat(result.versionNo()).isEqualTo(3);
    verify(validator).validateWorkspaceAccess(WORKSPACE_ID, USER_ID);
  }

  @Test
  @DisplayName("DRAFT domain pack version이 없으면 not found 예외를 던진다")
  void shouldThrowNotFoundWhenDraftEntryMissing() {
    given(domainPackRepository.findLatestDraftEntryByWorkspaceId(WORKSPACE_ID))
        .willReturn(Optional.empty());
    GetDomainPackDraftEntryQuery query = new GetDomainPackDraftEntryQuery(WORKSPACE_ID, USER_ID);

    assertThatThrownBy(() -> useCase.execute(query))
        .isInstanceOf(DomainPackDraftEntryNotFoundException.class);
  }

  @Test
  @DisplayName("workspace 접근 검증 실패 시 repository를 조회하지 않는다")
  void shouldNotQueryRepositoryWhenWorkspaceValidationFails() {
    willThrow(new DomainPackWorkspaceNotFoundException("워크스페이스를 찾을 수 없습니다."))
        .given(validator)
        .validateWorkspaceAccess(WORKSPACE_ID, USER_ID);
    GetDomainPackDraftEntryQuery query = new GetDomainPackDraftEntryQuery(WORKSPACE_ID, USER_ID);

    assertThatThrownBy(() -> useCase.execute(query))
        .isInstanceOf(DomainPackWorkspaceNotFoundException.class);
    verifyNoInteractions(domainPackRepository);
  }

  private static class StubDraftEntryRow implements DomainPackDraftEntryRow {

    @Override
    public Long getWorkspaceId() {
      return WORKSPACE_ID;
    }

    @Override
    public Long getPackId() {
      return 7L;
    }

    @Override
    public Long getVersionId() {
      return 101L;
    }

    @Override
    public String getPackName() {
      return "CS 정책팩";
    }

    @Override
    public Integer getVersionNo() {
      return 3;
    }
  }
}
