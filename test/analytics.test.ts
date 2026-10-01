import { describe, expect, it } from "vitest";

import {
  createAnalyticsApi,
  type FinancialAnalytics,
  type SpendingAnalytics,
} from "../src/api/client";
import {
  buildTrendPoints,
  categoryShares,
  latestMonth,
  trendArea,
  trendLine,
  visibleFinancialMonths,
  visibleSpendingMonths,
} from "../src/features/analytics/model";
import { formatMinorMoney } from "../src/presentation/format";
import { parseRoute } from "../src/routing";

const spending: SpendingAnalytics = {
  schema_version: 2,
  currency: "CNY",
  summary: {
    all_data: { total_spending_minor: 15000, transaction_count: 3, month_count: 2 },
    shown_data: { total_spending_minor: 12000, transaction_count: 2, month_count: 1 },
  },
  months: [
    {
      month: "2026-09",
      is_complete: false,
      show: false,
      total_spending_minor: 3000,
      transaction_count: 1,
      categories: [],
      merchants: [],
    },
    {
      month: "2026-08",
      is_complete: true,
      show: true,
      total_spending_minor: 12000,
      transaction_count: 2,
      categories: [
        { category: "餐饮", spending_minor: 9000, transaction_count: 1 },
        { category: "交通", spending_minor: 3000, transaction_count: 1 },
      ],
      merchants: [],
    },
  ],
  reconciliation: {
    zero_amount_transactions: 0,
    refund_transactions: 1,
    same_merchant_refund_matches: 1,
    same_merchant_matched_amount_minor: 2000,
    net_consumption_transactions: 3,
    fully_refunded_transactions: 1,
    partially_refunded_transactions: 0,
    unmatched_refund_count: 0,
    unmatched_refund_amount_minor: 0,
    unclassified_net_transactions: 1,
  },
};

const financial: FinancialAnalytics = {
  schema_version: 1,
  currency: "CNY",
  summary: {
    all_data: {
      total_income_minor: 30000,
      total_spending_minor: 15000,
      net_cash_flow_minor: 15000,
      income_transaction_count: 1,
      spending_transaction_count: 3,
      month_count: 2,
    },
    shown_data: {
      total_income_minor: 30000,
      total_spending_minor: 12000,
      net_cash_flow_minor: 18000,
      income_transaction_count: 1,
      spending_transaction_count: 2,
      month_count: 1,
    },
  },
  months: [
    {
      month: "2026-09",
      spending_data_complete: false,
      show: false,
      total_income_minor: 0,
      income_transaction_count: 0,
      total_spending_minor: 3000,
      spending_transaction_count: 1,
      net_cash_flow_minor: -3000,
    },
    {
      month: "2026-08",
      spending_data_complete: true,
      show: true,
      total_income_minor: 30000,
      income_transaction_count: 1,
      total_spending_minor: 12000,
      spending_transaction_count: 2,
      net_cash_flow_minor: 18000,
    },
  ],
};

describe("analytics presentation model", () => {
  it("uses only backend-visible statement months and derives category shares", () => {
    const spendingMonths = visibleSpendingMonths(spending);
    const financialMonths = visibleFinancialMonths(financial);

    expect(spendingMonths.map((month) => month.month)).toEqual(["2026-08"]);
    expect(financialMonths.map((month) => month.month)).toEqual(["2026-08"]);
    expect(latestMonth(spendingMonths)?.month).toBe("2026-08");
    expect(categoryShares(spendingMonths[0] ?? spending.months[1]!)).toEqual([
      { category: "餐饮", spendingMinor: 9000, transactionCount: 1, sharePercent: 75 },
      { category: "交通", spendingMinor: 3000, transactionCount: 1, sharePercent: 25 },
    ]);
  });

  it("builds finite SVG geometry and handles valid empty analytics", () => {
    const points = buildTrendPoints(visibleFinancialMonths(financial));
    expect(points).toHaveLength(1);
    expect(points[0]?.x).toBe(380);
    expect(Number.isFinite(points[0]?.y)).toBe(true);
    expect(trendLine(points)).toMatch(/^M /);
    expect(trendArea(points)).toMatch(/ Z$/);
    expect(visibleSpendingMonths({ ...spending, months: [] })).toEqual([]);
    expect(latestMonth([])).toBeNull();
  });

  it("formats minor units only when the backend supplies a currency", () => {
    expect(formatMinorMoney(1234, "CNY")).toContain("12.34");
    expect(formatMinorMoney(1234, null)).toBe("—");
  });
});

describe("AnalyticsApi", () => {
  it("reads both generated analytics contracts", async () => {
    const calls: string[] = [];
    const fakeFetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      const data = url.endsWith("/spending") ? spending : financial;
      return new Response(JSON.stringify({ data, meta: { request_id: "analytics" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    const api = createAnalyticsApi("https://backend.example", fakeFetch);

    await expect(api.getSpending()).resolves.toEqual(spending);
    await expect(api.getFinancial()).resolves.toEqual(financial);
    expect(calls).toEqual([
      "https://backend.example/api/v1/analytics/spending",
      "https://backend.example/api/v1/analytics/financial",
    ]);
  });
});

describe("analytics routes", () => {
  it("recognizes both dashboard hashes", () => {
    expect(parseRoute("#spending").page).toBe("spending");
    expect(parseRoute("#financial").page).toBe("financial");
  });
});
