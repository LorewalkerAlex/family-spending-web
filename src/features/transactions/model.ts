import type {
  TransactionListMeta,
  TransactionQuery,
  TransactionView,
} from "../../api/client";

export const PAGE_SIZE = 25;

export interface TransactionFilters {
  transactionType: "all" | "income" | "expense";
  classification: "all" | "classified" | "unclassified";
  category: string;
  description: string;
  month: string;
  sort: NonNullable<TransactionQuery["sort"]>;
}
export const defaultTransactionFilters: TransactionFilters = {
  transactionType: "all",
  classification: "all",
  category: "",
  description: "",
  month: "",
  sort: "date_desc",
};

export function transactionQuery(
  filters: TransactionFilters,
  offset: number,
  limit = PAGE_SIZE,
): TransactionQuery {
  return {
    offset,
    limit,
    sort: filters.sort,
    ...(filters.transactionType === "all"
      ? {}
      : { transaction_type: filters.transactionType }),
    ...(filters.classification === "all"
      ? {}
      : { is_unclassified: filters.classification === "unclassified" }),
    ...(filters.category.trim() ? { category: filters.category.trim() } : {}),
    ...(filters.description.trim() ? { description: filters.description.trim() } : {}),
    ...(filters.month ? { month: filters.month } : {}),
  };
}

export function pageSummary(meta: TransactionListMeta): string {
  if (meta.total === 0) return "0 条交易";
  const first = meta.offset + 1;
  const last = Math.min(meta.offset + meta.limit, meta.total);
  return `${first}–${last} / ${meta.total}`;
}

export function transactionTypeLabel(type: TransactionView["transaction"]["transaction_type"]): string {
  return type === "expense" ? "支出" : "收入";
}

export function categorySourceLabel(
  source: TransactionView["enrichment"]["category_source"],
): string {
  return {
    merchant_default: "商家默认分类",
    transaction_override: "单笔交易调整",
    income_default: "收入默认分类",
    unclassified: "待分类",
  }[source];
}

export function reviewSignalLabel(signal: string): string {
  return {
    other_expense_review: "其他支出需要复核",
    high_value_general_shopping_review: "高额综合购物需要复核",
  }[signal] ?? signal;
}
