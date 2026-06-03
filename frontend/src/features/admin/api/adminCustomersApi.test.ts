import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { apiClient } from "@/shared/api";
import { getAdminCustomerDetail, listAdminCustomers } from "./adminCustomersApi";

vi.mock("@/shared/api", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);

describe("adminCustomersApi", () => {
  beforeEach(() => {
    mockedGet.mockReset();
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
});
