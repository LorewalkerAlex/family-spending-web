import type {
  FinancialAnalytics,
  SpendingAnalytics,
} from "../../api/client";

export type SpendingMonth = SpendingAnalytics["months"][number];
export type FinancialMonth = FinancialAnalytics["months"][number];

export interface TrendPoint {
  month: string;
  value: number;
  x: number;
  y: number;
}

export interface CategoryShare {
  category: string;
  spendingMinor: number;
  transactionCount: number;
  sharePercent: number;
}

export function formatMonthLabel(month: string): string {
  const [year, number] = month.split("-");
  return `${year} 年 ${Number(number)} 月`;
}

export function visibleSpendingMonths(data: SpendingAnalytics): SpendingMonth[] {
  return data.months.filter((month) => month.show).sort((left, right) => (
    left.month.localeCompare(right.month)
  ));
}

export function visibleFinancialMonths(data: FinancialAnalytics): FinancialMonth[] {
  return data.months.filter((month) => month.show).sort((left, right) => (
    left.month.localeCompare(right.month)
  ));
}

export function latestMonth<T extends { month: string }>(months: readonly T[]): T | null {
  return months.length === 0 ? null : months[months.length - 1] ?? null;
}

export function categoryShares(month: SpendingMonth): CategoryShare[] {
  const total = month.total_spending_minor;
  return month.categories.map((item) => ({
    category: item.category,
    spendingMinor: item.spending_minor,
    transactionCount: item.transaction_count,
    sharePercent: total > 0 ? (item.spending_minor / total) * 100 : 0,
  }));
}

export function buildTrendPoints(
  months: readonly { month: string; total_spending_minor: number }[],
  width = 760,
  height = 220,
  padding = 24,
): TrendPoint[] {
  if (months.length === 0) return [];
  const values = months.map((month) => month.total_spending_minor);
  const max = Math.max(1, ...values);
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const denominator = Math.max(1, months.length - 1);

  return months.map((month, index) => ({
    month: month.month,
    value: month.total_spending_minor,
    x: months.length === 1 ? width / 2 : padding + (index / denominator) * usableWidth,
    y: height - padding - (month.total_spending_minor / max) * usableHeight,
  }));
}

export function trendLine(points: readonly TrendPoint[]): string {
  return points.map((point, index) => (
    `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
  )).join(" ");
}

export function trendArea(points: readonly TrendPoint[], baseline = 196): string {
  if (points.length === 0) return "";
  return `M ${points[0]?.x.toFixed(2)} ${baseline} ${trendLine(points).replace(/^M /, "L ")} L ${points.at(-1)?.x.toFixed(2)} ${baseline} Z`;
}
