import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IntentRevisionRecoveryBanner } from "./IntentRevisionRecoveryBanner";

describe("IntentRevisionRecoveryBanner", () => {
  it("첫 수정 저장 실패 후 복구 안내를 status로 노출한다", () => {
    render(<IntentRevisionRecoveryBanner />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "상담 유형 수정 초안은 생성됐지만 첫 수정 내용은 저장되지 않았습니다.",
    );
  });
});
