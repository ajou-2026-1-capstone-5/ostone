const KRW_FORMATTER = new Intl.NumberFormat("ko-KR");
const DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatAmount(amount: number | undefined, currency = "KRW"): string {
  if (amount === undefined) {
    return "-";
  }
  if (currency === "KRW") {
    return `${KRW_FORMATTER.format(amount)}원`;
  }
  return `${KRW_FORMATTER.format(amount)} ${currency}`;
}

export function formatDate(value: string | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return DATE_FORMATTER.format(date);
}
