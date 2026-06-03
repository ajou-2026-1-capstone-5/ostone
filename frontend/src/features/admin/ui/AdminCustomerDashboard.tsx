import { useMemo, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { ApiRequestError } from "@/shared/api";
import { Button } from "@/shared/ui/button/Button";
import {
  useAdminCustomerDetail,
  useAdminCustomers,
  type AdminCustomerDetail,
  type AdminCustomerSummary,
} from "../api/adminCustomersApi";
import styles from "./admin-customer-dashboard.module.css";

const PAGE_SIZE = 20;

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatStatus(value: string | null | undefined): string {
  return value ?? "미연동";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message || "고객사 정보를 불러오지 못했습니다.";
  }
  return "고객사 정보를 불러오지 못했습니다.";
}

export function AdminCustomerDashboard() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number | null>(null);
  const listParams = useMemo(
    () => ({ search, status, page, size: PAGE_SIZE }),
    [page, search, status],
  );
  const customersQuery = useAdminCustomers(listParams);
  const customers = customersQuery.data?.content ?? [];
  const selectedWorkspaceIsVisible = customers.some(
    (customer) => customer.workspace.id === selectedWorkspaceId,
  );
  const effectiveSelectedWorkspaceId =
    selectedWorkspaceIsVisible ? selectedWorkspaceId : (customers[0]?.workspace.id ?? null);
  const detailQuery = useAdminCustomerDetail(effectiveSelectedWorkspaceId);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(0);
    setSearch(searchInput.trim());
  };

  const handleStatusChange = (nextStatus: string) => {
    setStatus(nextStatus);
    setPage(0);
  };

  return (
    <div className={styles.dashboard}>
      <form className={styles.toolbar} onSubmit={handleSearch}>
        <label className={styles.searchField}>
          <span>검색</span>
          <div className={styles.searchBox}>
            <Search size={16} aria-hidden="true" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="고객사명 또는 workspace key"
            />
          </div>
        </label>
        <label className={styles.filterField}>
          <span>상태</span>
          <select value={status} onChange={(event) => handleStatusChange(event.target.value)}>
            <option value="">전체</option>
            <option value="ACTIVE">활성</option>
            <option value="ARCHIVED">보관</option>
          </select>
        </label>
        <Button type="submit">
          <Search size={16} />
          검색
        </Button>
      </form>

      {customersQuery.isLoading && <div className={styles.state}>고객사 현황을 불러오는 중입니다.</div>}
      {customersQuery.isError && (
        <div className={styles.state} role="alert">
          {getErrorMessage(customersQuery.error)}
        </div>
      )}
      {!customersQuery.isLoading && !customersQuery.isError && customers.length === 0 && (
        <div className={styles.state}>조건에 맞는 고객사가 없습니다.</div>
      )}

      {customers.length > 0 && (
        <div className={styles.grid}>
          <section className={styles.listPanel} aria-label="고객사 목록">
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>고객사</th>
                    <th>상태</th>
                    <th>멤버</th>
                    <th>구독</th>
                    <th>최근 업로드</th>
                    <th>최근 파이프라인</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <CustomerRow
                      key={customer.workspace.id}
                      customer={customer}
                      isSelected={customer.workspace.id === effectiveSelectedWorkspaceId}
                      onSelect={() => setSelectedWorkspaceId(customer.workspace.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.pagination}>
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                disabled={page === 0}
                aria-label="이전 페이지"
              >
                <ChevronLeft size={16} />
              </button>
              <span>{page + 1}</span>
              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={!customersQuery.data?.hasNext}
                aria-label="다음 페이지"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </section>

          <CustomerDetailPanel
            detail={detailQuery.data}
            isLoading={detailQuery.isLoading}
            error={detailQuery.error}
          />
        </div>
      )}
    </div>
  );
}

function CustomerRow({
  customer,
  isSelected,
  onSelect,
}: {
  customer: AdminCustomerSummary;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <tr className={isSelected ? styles.selectedRow : ""}>
      <td>
        <button
          type="button"
          className={styles.customerButton}
          onClick={onSelect}
          aria-label={`${customer.workspace.name} ${customer.workspace.workspaceKey}`}
        >
          <strong>{customer.workspace.name}</strong>
          <span>{customer.workspace.workspaceKey}</span>
        </button>
      </td>
      <td>{customer.workspace.status}</td>
      <td>{customer.memberCount}</td>
      <td>{formatStatus(customer.billing.subscriptionStatus)}</td>
      <td>{customer.latestUpload ? formatDateTime(customer.latestUpload.uploadedAt) : "-"}</td>
      <td>{formatStatus(customer.latestPipelineJob?.status)}</td>
    </tr>
  );
}

function CustomerDetailPanel({
  detail,
  isLoading,
  error,
}: {
  detail: AdminCustomerDetail | undefined;
  isLoading: boolean;
  error: unknown;
}) {
  if (isLoading) {
    return <aside className={styles.detailPanel}>상세 정보를 불러오는 중입니다.</aside>;
  }
  if (error) {
    return (
      <aside className={styles.detailPanel} role="alert">
        {getErrorMessage(error)}
      </aside>
    );
  }
  if (!detail) {
    return <aside className={styles.detailPanel}>선택된 고객사가 없습니다.</aside>;
  }
  return (
    <aside className={styles.detailPanel} aria-label="고객사 상세">
      <div className={styles.detailHeader}>
        <span>{detail.workspace.workspaceKey}</span>
        <h2>{detail.workspace.name}</h2>
        <p>{detail.workspace.description ?? "-"}</p>
      </div>
      <div className={styles.metricGrid}>
        <Metric label="상태" value={detail.workspace.status} />
        <Metric label="멤버" value={`${detail.members.totalCount}`} />
        <Metric label="구독" value={formatStatus(detail.billing.subscriptionStatus)} />
        <Metric label="파이프라인" value={`${detail.pipeline.totalCount}`} />
      </div>
      <section className={styles.detailSection}>
        <h3>멤버 요약</h3>
        <dl className={styles.compactStats}>
          <div>
            <dt>OWNER</dt>
            <dd>{detail.members.ownerCount}</dd>
          </div>
          <div>
            <dt>ADMIN</dt>
            <dd>{detail.members.adminCount}</dd>
          </div>
          <div>
            <dt>REVIEWER</dt>
            <dd>{detail.members.reviewerCount}</dd>
          </div>
          <div>
            <dt>OPERATOR</dt>
            <dd>{detail.members.operatorCount}</dd>
          </div>
        </dl>
      </section>
      <section className={styles.detailSection}>
        <h3>최근 멤버</h3>
        <ul className={styles.memberList}>
          {detail.members.recentMembers.length === 0 && <li>멤버 정보가 없습니다.</li>}
          {detail.members.recentMembers.map((member) => (
            <li key={member.memberId}>
              <strong>{member.name}</strong>
              <span>{member.email}</span>
              <em>{member.workspaceRole}</em>
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.detailSection}>
        <h3>업로드와 파이프라인</h3>
        <dl className={styles.definitionList}>
          <div>
            <dt>최근 업로드</dt>
            <dd>
              {detail.latestUpload
                ? `${detail.latestUpload.name} · ${formatDateTime(detail.latestUpload.uploadedAt)}`
                : "-"}
            </dd>
          </div>
          <div>
            <dt>최근 Job</dt>
            <dd>{formatStatus(detail.pipeline.latestJob?.status)}</dd>
          </div>
          <div>
            <dt>실행 중</dt>
            <dd>{detail.pipeline.runningCount}</dd>
          </div>
          <div>
            <dt>실패</dt>
            <dd>{detail.pipeline.failedCount}</dd>
          </div>
        </dl>
      </section>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
