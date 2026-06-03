import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ApiRequestError } from "@/shared/api";
import { createSuperAdminApi } from "../api/createSuperAdminApi";
import { CreateSuperAdminForm } from "./CreateSuperAdminForm";

vi.mock("../api/createSuperAdminApi", () => ({
  createSuperAdminApi: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockedCreateSuperAdminApi = vi.mocked(createSuperAdminApi);

describe("CreateSuperAdminForm", () => {
  beforeEach(() => {
    mockedCreateSuperAdminApi.mockReset();
  });

  it("입력한 정보로 SUPER_ADMIN 생성 API를 호출하고 성공 상태를 표시한다", async () => {
    mockedCreateSuperAdminApi.mockResolvedValueOnce({
      id: 10,
      name: "운영 관리자",
      email: "new-super@example.com",
      role: "SUPER_ADMIN",
    });

    render(<CreateSuperAdminForm />);

    await userEvent.type(screen.getByLabelText("이름"), "운영 관리자");
    await userEvent.type(screen.getByLabelText("이메일"), "new-super@example.com");
    await userEvent.type(screen.getByLabelText("임시 비밀번호"), "password123");
    await userEvent.click(screen.getByRole("button", { name: /SUPER_ADMIN 생성/ }));

    await waitFor(() => {
      expect(mockedCreateSuperAdminApi).toHaveBeenCalledWith({
        name: "운영 관리자",
        email: "new-super@example.com",
        password: "password123",
      });
    });
    expect(await screen.findByText("new-super@example.com")).toBeInTheDocument();
    expect(screen.getByText("SUPER_ADMIN")).toBeInTheDocument();
  });

  it("중복 이메일 오류를 form error로 표시한다", async () => {
    mockedCreateSuperAdminApi.mockRejectedValueOnce(
      new ApiRequestError(409, "EMAIL_ALREADY_EXISTS", "이미 사용 중인 이메일입니다."),
    );

    render(<CreateSuperAdminForm />);

    await userEvent.type(screen.getByLabelText("이름"), "운영 관리자");
    await userEvent.type(screen.getByLabelText("이메일"), "new-super@example.com");
    await userEvent.type(screen.getByLabelText("임시 비밀번호"), "password123");
    await userEvent.click(screen.getByRole("button", { name: /SUPER_ADMIN 생성/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("이미 사용 중인 이메일입니다.");
  });

  it("비밀번호 UTF-8 byte 길이가 범위를 벗어나면 API를 호출하지 않는다", async () => {
    render(<CreateSuperAdminForm />);

    await userEvent.type(screen.getByLabelText("이름"), "운영 관리자");
    await userEvent.type(screen.getByLabelText("이메일"), "new-super@example.com");
    await userEvent.type(screen.getByLabelText("임시 비밀번호"), "가".repeat(25));
    await userEvent.click(screen.getByRole("button", { name: /SUPER_ADMIN 생성/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "비밀번호는 UTF-8 기준 8바이트 이상 72바이트 이하로 입력해주세요.",
    );
    expect(mockedCreateSuperAdminApi).not.toHaveBeenCalled();
  });
});
