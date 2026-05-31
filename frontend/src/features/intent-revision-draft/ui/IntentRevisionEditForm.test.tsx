import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import type { IntentDetail } from "@/entities/intent";
import { intentRevisionDraftApi } from "../api/intentRevisionDraftApi";
import { IntentRevisionEditForm } from "./IntentRevisionEditForm";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("../api/intentRevisionDraftApi", () => ({
  intentRevisionDraftApi: {
    getIntent: vi.fn(),
  },
}));

const mockedGetIntent = vi.mocked(intentRevisionDraftApi.getIntent);
const mockedToastError = vi.mocked(toast.error);

const detail = {
  id: 10,
  intentCode: "refund",
  name: "환불 문의",
  description: "환불 조건을 확인합니다.",
  updatedAt: "2026-05-01T00:00:00Z",
} as IntentDetail;

function renderForm(props: Partial<React.ComponentProps<typeof IntentRevisionEditForm>> = {}) {
  const defaults = {
    wsId: 1,
    packId: 2,
    versionId: 3,
    detail,
    canEdit: true,
    isSaving: false,
    onSave: vi.fn().mockResolvedValue(true),
    onDirtyChange: vi.fn(),
  };

  const view = render(<IntentRevisionEditForm {...defaults} {...props} />);
  return { ...defaults, ...view };
}

describe("IntentRevisionEditForm", () => {
  beforeEach(() => {
    mockedGetIntent.mockReset();
    mockedToastError.mockReset();
    mockedGetIntent.mockResolvedValue(detail);
  });

  it("한국어 label과 접근성 연결을 가진 수정 form을 렌더링한다", () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "수정" }));

    expect(screen.getByLabelText("이름")).toHaveValue("환불 문의");
    expect(screen.getByLabelText("설명")).toHaveValue("환불 조건을 확인합니다.");
  });

  it("최신 intent와 충돌이 없으면 저장 후 편집 상태를 닫는다", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    renderForm({ onSave });

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "환불 문의 수정" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        name: "환불 문의 수정",
        description: "환불 조건을 확인합니다.",
      }),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "수정" })).toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("수정 적용 완료");
  });

  it("최신 intent가 변경되었으면 저장하지 않고 conflict dialog를 보여준다", async () => {
    const onSave = vi.fn();
    mockedGetIntent.mockResolvedValue({
      ...detail,
      name: "다른 사용자 수정",
      updatedAt: "2026-05-02T00:00:00Z",
    } as IntentDetail);
    renderForm({ onSave });

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "환불 문의 수정" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(screen.getByText("다른 사용자가 먼저 수정했습니다.")).toBeInTheDocument(),
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("최신 intent 조회 실패 시 toast를 띄우고 저장하지 않는다", async () => {
    const onSave = vi.fn();
    mockedGetIntent.mockRejectedValue(new Error("network down"));
    renderForm({ onSave });

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "환불 문의 수정" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(mockedToastError).toHaveBeenCalledWith(
        "최신 Intent 정보를 확인하지 못했습니다. network down",
      ),
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("저장 실패를 받으면 사용자의 입력을 유지한다", async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    renderForm({ onSave });

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "닫히면 안 되는 수정" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(screen.getByLabelText("이름")).toHaveValue("닫히면 안 되는 수정");
  });

  it("저장 요청이 reject되면 toast를 띄우고 사용자의 입력을 유지한다", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("patch failed"));
    renderForm({ onSave });

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "유지되어야 하는 수정" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(mockedToastError).toHaveBeenCalledWith(
        "상담 유형 수정 내용 저장에 실패했습니다. patch failed",
      ),
    );
    expect(screen.getByLabelText("이름")).toHaveValue("유지되어야 하는 수정");
  });

  it("취소하면 입력을 baseline으로 되돌리고 편집 상태를 닫는다", () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "취소될 수정" },
    });
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(screen.getByRole("button", { name: "수정" })).toBeInTheDocument();
  });

  it("detail이 바뀌는 순간 stale dirty 상태를 다시 보고하지 않는다", async () => {
    const onDirtyChange = vi.fn();
    const { rerender } = renderForm({ onDirtyChange });

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "임시 수정" },
    });

    await waitFor(() => expect(onDirtyChange).toHaveBeenCalledWith(true, 10));
    onDirtyChange.mockClear();

    rerender(
      <IntentRevisionEditForm
        wsId={1}
        packId={2}
        versionId={3}
        detail={{ ...detail, id: 11, intentCode: "delivery", name: "배송 문의" } as IntentDetail}
        canEdit
        isSaving={false}
        onSave={vi.fn().mockResolvedValue(true)}
        onDirtyChange={onDirtyChange}
      />,
    );

    await waitFor(() => expect(onDirtyChange).toHaveBeenCalledWith(false, null));
    expect(onDirtyChange).not.toHaveBeenCalledWith(true, 11);
  });

  it("최신 내용 불러오기를 누르면 conflict 데이터를 form baseline으로 반영한다", async () => {
    mockedGetIntent.mockResolvedValue({
      ...detail,
      name: "최신 이름",
      description: "최신 설명",
      updatedAt: "2026-05-02T00:00:00Z",
    } as IntentDetail);
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "사용자 수정" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(screen.getByText("다른 사용자가 먼저 수정했습니다.")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "최신 내용 불러오기" }));

    expect(screen.getByLabelText("이름")).toHaveValue("최신 이름");
    expect(screen.getByLabelText("설명")).toHaveValue("최신 설명");
  });

  it("필수/길이 검증 오류를 aria-invalid와 함께 보여준다", () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("설명"), {
      target: { value: "a".repeat(1001) },
    });

    expect(screen.getByText("이름을 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByText("설명은 1000자 이하로 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByLabelText("이름")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("설명")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });
});
