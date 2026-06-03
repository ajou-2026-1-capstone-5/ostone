import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/shared/api";
import {
  adminCustomerQueryKeys,
  getAdminCustomerDetail,
  listAdminCustomers,
  useAdminCustomerDetail,
  useAdminCustomers,
} from "./adminCustomersApi";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

vi.mock("@/shared/api", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);
const mockedUseQuery = vi.mocked(useQuery);

describe("adminCustomersApi", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedUseQuery.mockReset();
  });

  it("listAdminCustomers는 검색어와 상태 filter를 query string으로 전달한다", async () => {
    mockedGet.mockResolvedValueOnce({ content: [], page: 0, size: 20, hasNext: false });

    await listAdminCustomers({ search: " acme ", status: "ACTIVE", page: 0, size: 20 });

    expect(mockedGet).toHaveBeenCalledWith(
      "/admin/customers?page=0&size=20&q=acme&status=ACTIVE",
    );
  });

  it("getAdminCustomerDetail은 workspaceId path로 상세를 조회한다", async () => {
    mockedGet.mockResolvedValueOnce({});

    await getAdminCustomerDetail(7);

    expect(mockedGet).toHaveBeenCalledWith("/admin/customers/7");
  });

  it("query key는 검색어를 trim하고 list/detail scope를 분리한다", () => {
    expect(
      adminCustomerQueryKeys.list({ search: " acme ", status: "ARCHIVED", page: 2, size: 20 }),
    ).toEqual(["admin-customers", "list", "acme", "ARCHIVED", 2, 20]);
    expect(adminCustomerQueryKeys.detail(null)).toEqual(["admin-customers", "detail", null]);
  });

  it("useAdminCustomers는 list query function을 등록한다", async () => {
    mockedGet.mockResolvedValueOnce({ content: [], page: 1, size: 10, hasNext: false });

    useAdminCustomers({ search: "", status: "", page: 1, size: 10 });

    const options = mockedUseQuery.mock.calls[0][0];
    expect(options.queryKey).toEqual(["admin-customers", "list", "", "", 1, 10]);
    await options.queryFn();
    expect(mockedGet).toHaveBeenCalledWith("/admin/customers?page=1&size=10");
  });

  it("useAdminCustomerDetail은 workspaceId가 없으면 query를 비활성화한다", async () => {
    mockedGet.mockResolvedValueOnce({});

    useAdminCustomerDetail(null);

    const options = mockedUseQuery.mock.calls[0][0];
    expect(options.enabled).toBe(false);
    expect(options.queryKey).toEqual(["admin-customers", "detail", null]);
    await options.queryFn();
    expect(mockedGet).toHaveBeenCalledWith("/admin/customers/0");
  });
});
