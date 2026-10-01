import { describe, expect, it } from "vitest";

import {
  createTransactionApi,
  type TransactionView,
} from "../src/api/client";
import {
  pageSummary,
  transactionQuery,
  type TransactionFilters,
} from "../src/features/transactions/model";
import { parseRoute, transactionsRoute } from "../src/routing";

const transaction: TransactionView = {
  transaction: {
    id: "txn/with space",
    transaction_type: "expense",
    transaction_date: "2026-09-30",
    amount: "35.00",
    currency: "CNY",
  },
  authoritative_source_record_id: "source-1",
  description: "微信支付 测试商户",
  enrichment: {
    merchant_name: "测试商户",
    display_name: "测试商户",
    default_category: "餐饮",
    category: "餐饮",
    category_source: "merchant_default",
    is_unclassified: false,
    review_signals: [],
    note: null,
  },
};

describe("transaction presentation model", () => {
  it("translates UI filters into the generated API query without empty values", () => {
    const filters: TransactionFilters = {
      transactionType: "expense",
      classification: "classified",
      category: " 餐饮 ",
      description: " 微信支付 测试商户 ",
      sort: "amount_desc",
    };

    expect(transactionQuery(filters, 25)).toEqual({
      offset: 25,
      limit: 25,
      sort: "amount_desc",
      transaction_type: "expense",
      is_unclassified: false,
      category: "餐饮",
      description: "微信支付 测试商户",
    });
  });

  it("describes bounded pagination from backend metadata", () => {
    expect(pageSummary({
      request_id: "request-1",
      offset: 25,
      limit: 25,
      total: 42,
      sort: "date_desc",
    })).toBe("26–42 / 42");
  });
});

describe("TransactionApi", () => {
  it("serializes filters and reads list and detail contracts", async () => {
    const calls: string[] = [];
    const fakeFetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      const body = url.includes("txn%2Fwith%20space")
        ? { data: transaction, meta: { request_id: "detail" } }
        : {
            data: [transaction],
            meta: {
              request_id: "list",
              offset: 0,
              limit: 25,
              total: 1,
              sort: "date_desc",
            },
          };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    const api = createTransactionApi("https://backend.example/", fakeFetch);

    const listed = await api.listTransactions({
      offset: 0,
      limit: 25,
      description: "微信支付 测试商户",
      is_unclassified: false,
      sort: "date_desc",
    });
    await expect(api.getTransaction("txn/with space")).resolves.toEqual(transaction);

    expect(listed.data).toEqual([transaction]);
    const listUrl = new URL(calls[0] ?? "");
    expect(listUrl.pathname).toBe("/api/v1/transactions");
    expect(Object.fromEntries(listUrl.searchParams)).toEqual({
      offset: "0",
      limit: "25",
      description: "微信支付 测试商户",
      is_unclassified: "false",
      sort: "date_desc",
    });
    expect(calls[1]).toBe("https://backend.example/api/v1/transactions/txn%2Fwith%20space");
  });
});

describe("mapping-to-transaction route", () => {
  it("round-trips an exact source description without losing reserved characters", () => {
    const description = "支付宝 / 商户?订单=42 & 已完成";
    const route = transactionsRoute(description);

    expect(route).toContain("#transactions?description=");
    expect(parseRoute(route)).toEqual({ page: "transactions", description });
  });
});
