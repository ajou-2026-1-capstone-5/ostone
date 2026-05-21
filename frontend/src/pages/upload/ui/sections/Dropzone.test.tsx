import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast } from "sonner";

type MutationConfig = {
  mutation?: {
    onSuccess?: (response: unknown, variables: { data?: { file?: File } }) => void;
    onError?: (error: unknown) => void;
  };
};

const mockMutate = vi.fn();
let lastConfig: MutationConfig | null = null;

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/shared/api/generated/endpoints/dataset-controller/dataset-controller", () => ({
  useUploadRawFile: (config: MutationConfig) => {
    lastConfig = config;
    return {
      mutate: mockMutate,
      isPending: false,
      reset: vi.fn(),
    };
  },
}));

import { Dropzone } from "./Dropzone";

describe("Dropzone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastConfig = null;
  });

  it("idle 상태 안내 문구를 표시한다", () => {
    render(<Dropzone workspaceId={1} />);
    expect(screen.getByText("파일을 클릭하여 선택하세요")).toBeInTheDocument();
  });

  it("workspaceId 없으면 클릭 시 경고 토스트를 띄운다", () => {
    render(<Dropzone />);
    fireEvent.click(screen.getByRole("button"));
    expect(vi.mocked(toast.warning)).toHaveBeenCalledWith("워크스페이스를 먼저 선택하세요.");
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("Enter 키로도 클릭이 동작한다", () => {
    render(<Dropzone />);
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    expect(vi.mocked(toast.warning)).toHaveBeenCalledWith("워크스페이스를 먼저 선택하세요.");
  });

  it("Space 키로도 클릭이 동작한다", () => {
    render(<Dropzone />);
    fireEvent.keyDown(screen.getByRole("button"), { key: " " });
    expect(vi.mocked(toast.warning)).toHaveBeenCalledWith("워크스페이스를 먼저 선택하세요.");
  });

  it("Enter/Space 외 키는 무시한다", () => {
    render(<Dropzone workspaceId={1} />);
    fireEvent.keyDown(screen.getByRole("button"), { key: "Tab" });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("json 외 확장자는 거부한다", () => {
    const { container } = render(<Dropzone workspaceId={1} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "log.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("JSON 파일만 업로드할 수 있습니다.");
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("50MB 초과 파일은 거부한다", () => {
    const { container } = render(<Dropzone workspaceId={1} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const big = new File(["x"], "big.json", { type: "application/json" });
    Object.defineProperty(big, "size", { value: 51 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("파일 크기는 50MB 이하여야 합니다.");
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("workspaceId 없으면 파일이 들어와도 mutate 하지 않는다", () => {
    const { container } = render(<Dropzone />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "log.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("유효한 json 파일은 업로드 mutation 을 호출한다", () => {
    const { container } = render(<Dropzone workspaceId={7} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["{}"], "log.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const arg = mockMutate.mock.calls[0][0];
    expect(arg.workspaceId).toBe(7);
    expect(arg.params.sourceType).toBe("RAW");
    expect(arg.params.name).toBe("log.json");
    expect(typeof arg.params.datasetKey).toBe("string");
    expect(arg.data.file).toBe(file);
    expect(screen.getByText(/업로드 중\.\.\. log\.json/)).toBeInTheDocument();
  });

  it("onSuccess: 평면 응답 형태(datasetId)에서 성공 메시지를 표시한다", () => {
    render(<Dropzone workspaceId={1} />);
    act(() => {
      lastConfig?.mutation?.onSuccess?.(
        { datasetId: 42 },
        { data: { file: new File(["x"], "a.json") } },
      );
    });
    expect(screen.getByText(/업로드 완료 — a\.json \(dataset 42\)/)).toBeInTheDocument();
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("업로드 완료");
  });

  it("onSuccess: 래핑된 응답 형태({data:{datasetId}})도 처리한다", () => {
    render(<Dropzone workspaceId={1} />);
    act(() => {
      lastConfig?.mutation?.onSuccess?.(
        { data: { datasetId: 99 } },
        { data: { file: new File(["x"], "b.json") } },
      );
    });
    expect(screen.getByText(/업로드 완료 — b\.json \(dataset 99\)/)).toBeInTheDocument();
  });

  it("onSuccess: datasetId 가 없으면 -1 로 폴백한다", () => {
    render(<Dropzone workspaceId={1} />);
    act(() => {
      lastConfig?.mutation?.onSuccess?.({}, { data: { file: new File(["x"], "c.json") } });
    });
    expect(screen.getByText(/dataset -1/)).toBeInTheDocument();
  });

  it("onSuccess: null/primitive 응답에서도 TypeError 없이 -1 로 폴백한다", () => {
    render(<Dropzone workspaceId={1} />);
    act(() => {
      lastConfig?.mutation?.onSuccess?.(null, { data: { file: new File(["x"], "d.json") } });
    });
    expect(screen.getByText(/업로드 완료 — d\.json \(dataset -1\)/)).toBeInTheDocument();
  });

  it("onError(Error): 메시지와 토스트를 노출한다", () => {
    render(<Dropzone workspaceId={1} />);
    act(() => {
      lastConfig?.mutation?.onError?.(new Error("네트워크 실패"));
    });
    expect(screen.getByText(/업로드 실패: 네트워크 실패/)).toBeInTheDocument();
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("네트워크 실패");
  });

  it("onError(비 Error 객체): 기본 메시지로 폴백한다", () => {
    render(<Dropzone workspaceId={1} />);
    act(() => {
      lastConfig?.mutation?.onError?.("boom");
    });
    expect(screen.getByText(/업로드 실패: 업로드에 실패했습니다\./)).toBeInTheDocument();
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("업로드에 실패했습니다.");
  });
});
