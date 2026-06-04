import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PlanCatalogEntry } from "@/entities/billing";

import { PlanComparison } from "./PlanComparison";

const catalog: PlanCatalogEntry[] = [
  {
    planKey: "pro_monthly",
    name: "Pro (Monthly)",
    amount: 29000,
    currency: "KRW",
    interval: "MONTH",
    memberLimit: 3,
    datasetUploadLimit: 10,
    pipelineRunHourlyLimit: 1,
    contactOnly: false,
    unlimited: false,
  },
  {
    planKey: "max_monthly",
    name: "Max (Monthly)",
    amount: 49000,
    currency: "KRW",
    interval: "MONTH",
    memberLimit: 10,
    datasetUploadLimit: 10,
    pipelineRunHourlyLimit: 5,
    contactOnly: false,
    unlimited: false,
  },
  {
    planKey: "enterprise",
    name: "Enterprise",
    amount: 0,
    currency: "KRW",
    interval: "MONTH",
    memberLimit: -1,
    datasetUploadLimit: -1,
    pipelineRunHourlyLimit: -1,
    contactOnly: true,
    unlimited: true,
  },
];

describe("PlanComparison", () => {
  it("Free + 카탈로그 3개 = 4개 카드를 렌더링한다", () => {
    render(
      <PlanComparison
        catalog={catalog}
        currentPlanKey={null}
        renderAction={(entry) => <span>action:{entry.planKey}</span>}
      />,
    );

    expect(screen.getByText("Free")).toBeTruthy();
    expect(screen.getByText("Pro")).toBeTruthy();
    expect(screen.getByText("Max")).toBeTruthy();
    expect(screen.getByText("Enterprise")).toBeTruthy();
  });

  it("미구독이면 Free가 현재 플랜이고 Pro가 인기다", () => {
    render(
      <PlanComparison catalog={catalog} currentPlanKey={null} renderAction={() => <span />} />,
    );

    expect(screen.getByText("현재 플랜")).toBeTruthy();
    expect(screen.getByText("인기")).toBeTruthy();
  });

  it("Enterprise는 가격 대신 문의로 표시한다", () => {
    render(
      <PlanComparison catalog={catalog} currentPlanKey={null} renderAction={() => <span />} />,
    );
    expect(screen.getByText("문의")).toBeTruthy();
  });

  it("renderAction에 각 카드의 planKey/current를 전달한다", () => {
    render(
      <PlanComparison
        catalog={catalog}
        currentPlanKey="pro_monthly"
        renderAction={(entry) => (
          <span>
            {entry.planKey}:{entry.current ? "current" : "other"}
          </span>
        )}
      />,
    );
    expect(screen.getByText("pro_monthly:current")).toBeTruthy();
    expect(screen.getByText("free:other")).toBeTruthy();
    expect(screen.getByText("enterprise:other")).toBeTruthy();
  });

  it("백엔드 정렬과 무관하게 Free→유료→Enterprise 순서로 표시한다", () => {
    // 백엔드 amount 오름차순(enterprise amount 0이 앞)으로 들어와도 화면은 Free/Pro/Max/Enterprise
    const unsorted: PlanCatalogEntry[] = [catalog[2], catalog[0], catalog[1]];
    render(
      <PlanComparison catalog={unsorted} currentPlanKey={null} renderAction={() => <span />} />,
    );
    const names = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(["Free", "Pro", "Max", "Enterprise"]);
  });

  it("PLAN_COPY에 없는 planKey는 카탈로그 name으로 폴백한다", () => {
    const unknown: PlanCatalogEntry[] = [
      {
        planKey: "starter_monthly",
        name: "Starter (Monthly)",
        amount: 9000,
        currency: "KRW",
        interval: "MONTH",
        memberLimit: 1,
        datasetUploadLimit: 5,
        pipelineRunHourlyLimit: 1,
        contactOnly: false,
        unlimited: false,
      },
    ];
    render(
      <PlanComparison catalog={unknown} currentPlanKey={null} renderAction={() => <span />} />,
    );
    expect(screen.getByText("Starter (Monthly)")).toBeTruthy();
    expect(screen.getByText("9,000원")).toBeTruthy();
  });
});
