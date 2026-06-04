import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EnterpriseContactDialog } from "./EnterpriseContactDialog";

describe("EnterpriseContactDialog", () => {
  it("기본 트리거 라벨 '도입 문의'를 렌더링한다", () => {
    render(<EnterpriseContactDialog />);
    expect(screen.getByRole("button", { name: "도입 문의" })).toBeTruthy();
  });

  it("트리거 클릭 시 다이얼로그에 연락처를 표시한다", async () => {
    render(<EnterpriseContactDialog />);
    expect(screen.queryByText("02-XXX-XXXX")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "도입 문의" }));

    // 전화번호 자체가 tel: 링크(누르면 바로 연결). 별도 '전화 걸기' 버튼/수화기 아이콘 없음.
    const phoneLink = await screen.findByRole("link", { name: "02-XXX-XXXX" });
    expect(phoneLink.getAttribute("href")).toBe("tel:02-XXX-XXXX");
    // 제목은 sr-only로 DOM에는 존재(a11y)
    expect(screen.getByText("Enterprise 도입 문의")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "전화 걸기" })).toBeNull();
  });

  it("전화번호를 애플 2FA 스타일 박스(테두리·라운드)에 담고 영업시간을 표시한다", () => {
    render(<EnterpriseContactDialog />);
    fireEvent.click(screen.getByRole("button", { name: "도입 문의" }));

    const phoneBox = screen.getByTestId("enterprise-phone-link");
    // rounded-rectangle 박스: 라운드 + 테두리 + 채움
    expect(phoneBox.className).toContain("rounded-[18px]");
    expect(phoneBox.className).toContain("border");
    expect(phoneBox.getAttribute("href")).toBe("tel:02-XXX-XXXX");
    // 영업시간 안내는 작게 유지
    expect(screen.getByText(/평일 10:00 – 18:00/)).toBeTruthy();
  });

  it("커스텀 트리거 라벨을 지원한다", () => {
    render(<EnterpriseContactDialog triggerLabel="영업팀 문의" />);
    expect(screen.getByRole("button", { name: "영업팀 문의" })).toBeTruthy();
  });
});
