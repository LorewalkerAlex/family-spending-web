export function formatMoney(amount: string, currency: string): string {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return `${amount} ${currency}`;

  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
  }).format(numeric);
}

export function formatMinorMoney(minor: number, currency: string | null): string {
  if (!currency) return "—";
  return formatMoney((minor / 100).toFixed(2), currency);
}
