import { useEffect, useMemo, useState, type FormEvent } from "react";
import { RefreshCw, RotateCcw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { ApiRequestError } from "@/shared/api";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import {
  fetchAdminBillingCustomers,
  refundAdminBillingPayment,
  type AdminBillingCustomerResponse,
} from "../api/adminBillingApi";
import styles from "./admin-billing-management.module.css";

const REFUNDABLE_STATUS = "DONE";

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "미등록";
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "미등록";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function statusLabel(value: string | null | undefined): string {
  return value || "미등록";
}

export function AdminBillingManagement() {
  const [customers, setCustomers] = useState<AdminBillingCustomerResponse[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AdminBillingCustomerResponse | null>(null);
  const [reason, setReason] = useState("");
  const [refundError, setRefundError] = useState("");
  const [isRefunding, setIsRefunding] = useState(false);

  const loadCustomers = async () => {
    setIsLoading(true);
    setError("");
    try {
      setCustomers(await fetchAdminBillingCustomers());
    } catch (err) {
      const message =
        err instanceof ApiRequestError
          ? err.message
          : "결제 현황을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery) return customers;
    return customers.filter((customer) =>
      `${customer.workspaceName} ${customer.workspaceKey}`.toLowerCase().includes(trimmedQuery),
    );
  }, [customers, query]);

  const openRefundDialog = (customer: AdminBillingCustomerResponse) => {
    setSelected(customer);
    setReason("");
    setRefundError("");
  };

  const closeRefundDialog = () => {
    if (isRefunding) return;
    setSelected(null);
    setReason("");
    setRefundError("");
  };

  const handleRefund = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected?.recentPayment) return;

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setRefundError("환불 사유를 입력해주세요.");
      return;
    }

    setIsRefunding(true);
    setRefundError("");
    try {
      await refundAdminBillingPayment(selected.recentPayment.id, trimmedReason);
      toast.success("전체 환불이 완료되었습니다.");
      closeRefundDialog();
      await loadCustomers();
    } catch (err) {
      const message =
        err instanceof ApiRequestError
          ? err.message
          : "전체 환불을 실행하지 못했습니다. 잠시 후 다시 시도해주세요.";
      setRefundError(message);
      toast.error(message);
    } finally {
      setIsRefunding(false);
    }
  };

  return (
    <div className={styles.surface}>
      <div className={styles.toolbar}>
        <Input
          label="고객사 검색"
          icon={<Search size={16} />}
          placeholder="워크스페이스 이름 또는 키"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button variant="secondary" onClick={() => void loadCustomers()} isLoading={isLoading}>
          <RefreshCw size={16} />
          새로고침
        </Button>
      </div>

      {isLoading && <div className={styles.state}>결제 현황을 불러오는 중입니다.</div>}

      {!isLoading && error && (
        <div className={styles.state} role="alert">
          <p>{error}</p>
          <Button variant="secondary" onClick={() => void loadCustomers()}>
            다시 시도
          </Button>
        </div>
      )}

      {!isLoading && !error && filteredCustomers.length === 0 && (
        <div className={styles.state}>조회할 결제 현황이 없습니다.</div>
      )}

      {!isLoading && !error && filteredCustomers.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>고객사</th>
                <th>구독</th>
                <th>기간</th>
                <th>다음 결제일</th>
                <th>최근 결제</th>
                <th>실패 상태</th>
                <th>환불</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => {
                const payment = customer.recentPayment;
                const canRefund = payment?.status === REFUNDABLE_STATUS;
                return (
                  <tr key={customer.workspaceId}>
                    <td>
                      <strong>{customer.workspaceName}</strong>
                      <span>{customer.workspaceKey}</span>
                    </td>
                    <td>
                      <strong>{statusLabel(customer.subscription.status)}</strong>
                      <span>
                        {customer.subscription.planName || "요금제 미등록"} ·{" "}
                        {formatCurrency(customer.subscription.planAmount)}
                      </span>
                    </td>
                    <td>
                      <span>{formatDate(customer.subscription.currentPeriodStart)}</span>
                      <span>{formatDate(customer.subscription.currentPeriodEnd)}</span>
                    </td>
                    <td>{formatDate(customer.subscription.nextBillingAt)}</td>
                    <td>
                      {payment ? (
                        <>
                          <strong>{payment.status}</strong>
                          <span>
                            {formatCurrency(payment.amount)} · {formatDate(payment.approvedAt)}
                          </span>
                        </>
                      ) : (
                        "결제 없음"
                      )}
                    </td>
                    <td>{statusLabel(customer.failedStatus)}</td>
                    <td>
                      <Button
                        variant="secondary"
                        disabled={!canRefund}
                        onClick={() => openRefundDialog(customer)}
                      >
                        <RotateCcw size={15} />
                        전체 환불
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected?.recentPayment && (
        <div className={styles.modalBackdrop} role="presentation">
          <form className={styles.modal} onSubmit={handleRefund} role="dialog" aria-modal="true">
            <button
              type="button"
              className={styles.closeButton}
              onClick={closeRefundDialog}
              aria-label="닫기"
              disabled={isRefunding}
            >
              <X size={18} />
            </button>
            <div>
              <p className={styles.modalEyebrow}>Full refund</p>
              <h2>{selected.workspaceName} 전체 환불</h2>
            </div>
            <dl className={styles.refundSummary}>
              <div>
                <dt>결제 금액</dt>
                <dd>{formatCurrency(selected.recentPayment.amount)}</dd>
              </div>
              <div>
                <dt>결제 상태</dt>
                <dd>{selected.recentPayment.status}</dd>
              </div>
            </dl>
            <label className={styles.reasonField}>
              <span>환불 사유</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                rows={4}
                placeholder="고객 요청으로 전체 환불"
              />
            </label>
            {refundError && (
              <p className={styles.errorText} role="alert">
                {refundError}
              </p>
            )}
            <div className={styles.modalActions}>
              <Button
                type="button"
                variant="ghost"
                onClick={closeRefundDialog}
                disabled={isRefunding}
              >
                취소
              </Button>
              <Button type="submit" isLoading={isRefunding}>
                <RotateCcw size={16} />
                전체 환불 실행
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
