import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';

const mockMutate = vi.fn();
const mockNavigate = vi.fn();
const mockReset = vi.fn();

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

let callOnSuccess: (() => void) | null = null;

vi.mock('../../../shared/api/generated/endpoints/dataset-controller/dataset-controller', () => ({
  useUploadRawFile: (config: { mutation?: { onSuccess?: () => void } }) => {
    callOnSuccess = config?.mutation?.onSuccess ?? null;
    return {
      mutate: (...args: unknown[]) => {
        mockMutate(...args);
        callOnSuccess?.();
      },
      isPending: false,
      reset: mockReset,
    };
  },
}));

vi.mock('../../../shared/ui/file-upload/FileUploader', () => ({
  FileUploader: ({ onFileSelect, status }: { onFileSelect: (f: File) => void; status: string }) => (
    <div data-testid="file-uploader">
      {status}
      <input
        data-testid="file-input"
        type="file"
        onChange={(e) => {
          if (e.target.files?.[0]) onFileSelect(e.target.files[0]);
        }}
      />
    </div>
  ),
}));

import { LogUploadForm } from './LogUploadForm';

describe('LogUploadForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders upload header and file uploader', () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    expect(screen.getByText('Upload Consult Logs')).toBeInTheDocument();
    expect(screen.getByTestId('file-uploader')).toBeInTheDocument();
  });

  it('shows file preview and Start Processing button after selecting a file', () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText('Start Processing')).toBeInTheDocument();
    expect(screen.getByText('test.csv')).toBeInTheDocument();
  });

  it('rejects non-CSV/JSON files with toast error', () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [file] } });
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith('CSV 또는 JSON 파일만 업로드할 수 있습니다.');
  });

  it('calls mutate on Start Processing click', () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(['data'], 'data.csv', { type: 'text/csv' });
    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText('Start Processing'));
    expect(mockMutate).toHaveBeenCalled();
  });

  it('does not call mutate when workspaceId is undefined', () => {
    render(<LogUploadForm />, { wrapper: MemoryRouter });
    const file = new File(['data'], 'data.csv', { type: 'text/csv' });
    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [file] } });
    const btn = screen.queryByText('Start Processing');
    if (btn) fireEvent.click(btn);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('shows success actions after successful upload', () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(['data'], 'data.csv', { type: 'text/csv' });
    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText('Start Processing'));
    expect(screen.getByText('Upload Another File')).toBeInTheDocument();
    expect(screen.getByText('도메인팩 보기')).toBeInTheDocument();
  });

  it('navigates to domain packs on success action click', () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(['data'], 'data.csv', { type: 'text/csv' });
    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText('Start Processing'));
    fireEvent.click(screen.getByText('도메인팩 보기'));
    expect(mockNavigate).toHaveBeenCalledWith('/workspaces/1/domain-packs');
  });

  it('resets form state when Upload Another File is clicked', () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(['data'], 'data.csv', { type: 'text/csv' });
    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText('Start Processing'));
    expect(screen.getByText('Upload Another File')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Upload Another File'));
    expect(mockReset).toHaveBeenCalled();
    expect(screen.queryByText('Upload Another File')).not.toBeInTheDocument();
    expect(screen.getByText('Upload Consult Logs')).toBeInTheDocument();
  });
});
