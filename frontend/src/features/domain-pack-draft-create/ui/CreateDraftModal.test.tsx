import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiRequestError } from '@/shared/api';
import { useCreateDraft } from '../model/useCreateDraft';
import { CreateDraftModal } from './CreateDraftModal';

vi.mock('../model/useCreateDraft', () => ({
  useCreateDraft: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedUseCreateDraft = vi.mocked(useCreateDraft);

function makeMutation(overrides: Record<string, unknown> = {}) {
  return {
    isPending: false,
    isError: false,
    mutate: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useCreateDraft>;
}

function renderModal(props: Partial<React.ComponentProps<typeof CreateDraftModal>> = {}) {
  const defaults = {
    wsId: 1,
    packId: 2,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };
  render(<CreateDraftModal {...defaults} {...props} />);
  return defaults;
}

describe('CreateDraftModal', () => {
  beforeEach(() => {
    mockedUseCreateDraft.mockReset();
    mockedUseCreateDraft.mockReturnValue(makeMutation());
    // jsdom does not implement showModal — simulate by setting the open attribute
    HTMLDialogElement.prototype.showModal = function(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  });

  afterEach(() => {
    delete (HTMLDialogElement.prototype as { showModal?: unknown }).showModal;
  });

  it('모달 제목과 textarea를 렌더링한다', () => {
    renderModal();
    expect(screen.getByText('새 DRAFT 묶기')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('취소 버튼 클릭 시 onClose를 호출한다', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('닫기(✕) 버튼 클릭 시 onClose를 호출한다', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('유효하지 않은 JSON 제출 시 인라인 에러를 표시한다', () => {
    renderModal();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{bad}' } });
    fireEvent.click(screen.getByRole('button', { name: '묶기' }));
    expect(screen.getByRole('alert')).toHaveTextContent('유효하지 않은 JSON입니다');
  });

  it('409 에러 응답 시 인라인 에러 "동일 Pack 묶기 충돌"을 표시한다', async () => {
    const mutate = vi.fn(
      (_params: unknown, callbacks: { onError: (e: unknown) => void }) => {
        callbacks.onError(new ApiRequestError(409, 'CONFLICT', 'conflict'));
      },
    );
    mockedUseCreateDraft.mockReturnValue(makeMutation({ mutate }));
    renderModal();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{}' } });
    fireEvent.click(screen.getByRole('button', { name: '묶기' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('동일 Pack 묶기 충돌'),
    );
  });

  it('400 에러 응답 시 인라인 에러 "요청 검증 실패"를 표시한다', async () => {
    const mutate = vi.fn(
      (_params: unknown, callbacks: { onError: (e: unknown) => void }) => {
        callbacks.onError(
          new ApiRequestError(400, 'BAD_REQUEST', '요청 검증 실패. 입력을 확인해 주세요.'),
        );
      },
    );
    mockedUseCreateDraft.mockReturnValue(makeMutation({ mutate }));
    renderModal();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{}' } });
    fireEvent.click(screen.getByRole('button', { name: '묶기' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('요청 검증 실패'),
    );
  });

  it('isPending 상태에서 묶기 버튼이 비활성화된다', () => {
    mockedUseCreateDraft.mockReturnValue(makeMutation({ isPending: true }));
    renderModal();
    expect(screen.getByRole('button', { name: '생성 중...' })).toBeDisabled();
  });
});
