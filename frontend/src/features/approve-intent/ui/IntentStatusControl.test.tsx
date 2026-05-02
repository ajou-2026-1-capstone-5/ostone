import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IntentStatusControl } from "./IntentStatusControl";

describe("IntentStatusControl", () => {
  const onPublish = vi.fn();
  const onReject = vi.fn();

  it("intentStatus='DRAFT'일 때 publish/reject 버튼이 모두 enabled", () => {
    render(
      <IntentStatusControl
        intentStatus="DRAFT"
        onPublish={onPublish}
        onReject={onReject}
        isPending={false}
      />,
    );

    expect(screen.getByRole("button", { name: "승인" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "반려" })).toBeEnabled();
  });

  it("intentStatus='PUBLISHED'일 때 publish 버튼이 disabled", () => {
    render(
      <IntentStatusControl
        intentStatus="PUBLISHED"
        onPublish={onPublish}
        onReject={onReject}
        isPending={false}
      />,
    );

    expect(screen.getByRole("button", { name: "승인" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "반려" })).toBeDisabled();
  });

  it("intentStatus='REJECTED'일 때 두 버튼이 모두 disabled", () => {
    render(
      <IntentStatusControl
        intentStatus="REJECTED"
        onPublish={onPublish}
        onReject={onReject}
        isPending={false}
      />,
    );

    expect(screen.getByRole("button", { name: "승인" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "반려" })).toBeDisabled();
  });

  it("isPending=true일 때 두 버튼이 모두 disabled", () => {
    render(
      <IntentStatusControl
        intentStatus="DRAFT"
        onPublish={onPublish}
        onReject={onReject}
        isPending={true}
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).toBeDisabled();
  });

  it("publish 버튼 클릭 시 onPublish 호출", () => {
    render(
      <IntentStatusControl
        intentStatus="DRAFT"
        onPublish={onPublish}
        onReject={onReject}
        isPending={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "승인" }));
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it("reject 버튼 클릭 시 onReject 호출", () => {
    render(
      <IntentStatusControl
        intentStatus="DRAFT"
        onPublish={onPublish}
        onReject={onReject}
        isPending={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "반려" }));
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it("isPending=true일 때 버튼 텍스트가 '처리 중...'", () => {
    render(
      <IntentStatusControl
        intentStatus="DRAFT"
        onPublish={onPublish}
        onReject={onReject}
        isPending={true}
      />,
    );

    const buttons = screen.getAllByRole("button", { name: "처리 중..." });
    expect(buttons).toHaveLength(2);
  });
});
