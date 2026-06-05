import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  detail,
  list1,
} from "@/shared/api/generated/endpoints/admin-customer-controller/admin-customer-controller";
import {
  adminCustomerQueryKeys,
  getAdminCustomerDetail,
  listAdminCustomers,
  useAdminCustomerDetail,
  useAdminCustomers,
} from "./adminCustomersApi";

vi.mock(
  "@/shared/api/generated/endpoints/admin-customer-controller/admin-customer-controller",
  () => ({
    list1: vi.fn(),
    detail: vi.fn(),
  }),
);

const mockedList1 = vi.mocked(list1);
const mockedDetail = vi.mocked(detail);

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  mockedList1.mockReset();
  mockedDetail.mockReset();
});

describe("adminCustomersApi", () => {
  it("listAdminCustomers는 검색어 trim과 상태 filter를 generated list1 params로 전달하고 data를 unwrap한다", async () => {
    const slice = { content: [], page: 0, size: 20, hasNext: false };
    mockedList1.mockResolvedValueOnce({
      data: slice,
      status: 200,
    } as unknown as Awaited<ReturnType<typeof list1>>);

    const result = await listAdminCustomers({
      search: " acme ",
      status: "ACTIVE",
      page: 0,
      size: 20,
    });

    expect(mockedList1).toHaveBeenCalledWith({ page: 0, size: 20, q: "acme", status: "ACTIVE" });
    expect(result).toEqual(slice);
  });

  it("listAdminCustomers는 빈 검색어와 상태를 params에서 제외한다", async () => {
    mockedList1.mockResolvedValueOnce({
      data: { content: [], page: 1, size: 10, hasNext: false },
      status: 200,
    } as unknown as Awaited<ReturnType<typeof list1>>);

    await listAdminCustomers({ search: "  ", status: "", page: 1, size: 10 });

    expect(mockedList1).toHaveBeenCalledWith({ page: 1, size: 10 });
  });

  it("getAdminCustomerDetail은 generated detail(workspaceId)로 조회하고 data를 unwrap한다", async () => {
    const data = { workspace: { id: 7 } };
    mockedDetail.mockResolvedValueOnce({
      data,
      status: 200,
    } as unknown as Awaited<ReturnType<typeof detail>>);

    const result = await getAdminCustomerDetail(7);

    expect(mockedDetail).toHaveBeenCalledWith(7);
    expect(result).toEqual(data);
  });

  it("query key는 검색어를 trim하고 list/detail scope를 분리한다", () => {
    expect(
      adminCustomerQueryKeys.list({ search: " acme ", status: "ARCHIVED", page: 2, size: 20 }),
    ).toEqual(["admin-customers", "list", "acme", "ARCHIVED", 2, 20]);
    expect(adminCustomerQueryKeys.detail(null)).toEqual(["admin-customers", "detail", null]);
  });

  it("useAdminCustomers는 list query를 등록하고 generated list1을 호출한다", async () => {
    mockedList1.mockResolvedValue({
      data: { content: [], page: 1, size: 10, hasNext: false },
      status: 200,
    } as unknown as Awaited<ReturnType<typeof list1>>);

    const { result } = renderHook(
      () => useAdminCustomers({ search: "", status: "", page: 1, size: 10 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedList1).toHaveBeenCalledWith({ page: 1, size: 10 });
  });

  it("useAdminCustomerDetail은 workspaceId가 없으면 query를 비활성화한다", () => {
    const { result } = renderHook(() => useAdminCustomerDetail(null), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedDetail).not.toHaveBeenCalled();
  });

  it("useAdminCustomerDetail은 workspaceId가 있으면 generated detail을 호출한다", async () => {
    mockedDetail.mockResolvedValue({
      data: { workspace: { id: 9 } },
      status: 200,
    } as unknown as Awaited<ReturnType<typeof detail>>);

    const { result } = renderHook(() => useAdminCustomerDetail(9), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedDetail).toHaveBeenCalledWith(9);
  });
});
